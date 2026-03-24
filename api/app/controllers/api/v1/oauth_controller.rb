# frozen_string_literal: true

require "net/http"
require "json"

module Api
  module V1
    class OauthController < BaseController
      skip_before_action :authenticate_user!

      GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
      GOOGLE_ISSUERS   = %w[https://accounts.google.com accounts.google.com].freeze

      # POST /api/v1/auth/google
      # Accepts a Google ID token from the React frontend (via @react-oauth/google).
      # Verifies it locally using Google's cached public keys, then finds or creates a
      # User and returns a CatCare JWT. No synchronous call to Google on each login.
      def google
        credential = params[:credential]
        return render_error("MISSING_CREDENTIAL", "Google credential is required", :bad_request) if credential.blank?

        google_payload = verify_google_token(credential)
        return render_error("INVALID_CREDENTIAL", "Google token verification failed", :unauthorized) if google_payload.nil?

        email = google_payload["email"]&.downcase
        name  = google_payload["name"].presence || email.split("@").first
        uid   = google_payload["sub"]

        user = find_or_create_oauth_user(email: email, name: name, uid: uid, provider: "google")
        return render_error("OAUTH_FAILED", "Unable to sign in with Google", :unprocessable_entity) if user.nil?

        token, _payload = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
        response.set_header("Authorization", "Bearer #{token}")

        render json: {
          data: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        }, status: :ok
      end

      private

      # Verifies the Google ID token locally using Google's cached JWKS public keys.
      # This avoids a synchronous HTTP call to Google on every login; the public keys
      # are fetched once and cached in Rails.cache for their TTL (~24 h).
      # Returns the decoded payload hash on success, nil on failure.
      def verify_google_token(credential)
        jwks = fetch_google_jwks
        return nil if jwks.nil?

        payload, _header = JWT.decode(
          credential,
          jwks,
          true,
          algorithms:      %w[RS256],
          iss:             GOOGLE_ISSUERS,
          verify_iss:      true,
          aud:             ENV["GOOGLE_CLIENT_ID"],
          verify_aud:      true,
          verify_expiration: true
        )
        payload
      rescue JWT::DecodeError, StandardError
        nil
      end

      # Fetches and caches Google's JSON Web Key Set.
      # Keys are stable for ~24 h; we cache for 1 h to stay ahead of any rotation.
      # On fetch failure we return nil without caching, so the next request retries.
      def fetch_google_jwks
        Rails.cache.fetch("google_oauth_jwks", expires_in: 1.hour) do
          uri  = URI(GOOGLE_CERTS_URL)
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl      = true
          http.open_timeout = 5
          http.read_timeout = 5
          resp = http.get(uri.request_uri)
          raise "Unexpected response: #{resp.code}" unless resp.is_a?(Net::HTTPSuccess)
          JWT::JWK::Set.new(JSON.parse(resp.body))
        end
      rescue StandardError
        nil
      end

      # Finds an existing user by OAuth identity or email, or creates a new one.
      # Handles account linking: if a user registered with email/password first and now
      # signs in with Google using the same address, we attach the OAuth identity to their
      # existing account so they aren't duplicated.
      def find_or_create_oauth_user(email:, name:, uid:, provider:)
        # 1. Exact OAuth identity match
        user = User.find_by(provider: provider, uid: uid)
        return user if user

        # 2. Existing email/password account — link it
        user = User.find_by(email: email)
        if user
          user.update!(provider: provider, uid: uid)
          return user
        end

        # 3. New user — create with a random secure password (they won't use it)
        User.create!(
          email:    email,
          name:     name,
          provider: provider,
          uid:      uid,
          password: SecureRandom.hex(24)
        )
      rescue ActiveRecord::RecordInvalid
        nil
      end
    end
  end
end
