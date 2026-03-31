# frozen_string_literal: true

require "net/http"
require "json"

module Api
  module V1
    class OauthController < BaseController
      skip_before_action :authenticate_user!

      GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
      GOOGLE_ISSUERS       = %w[https://accounts.google.com accounts.google.com].freeze

      # POST /api/v1/auth/google
      # Accepts a Google ID token from the React frontend (via @react-oauth/google).
      # Verifies it locally using Google's cached public keys, then finds or creates a
      # User and returns a CatCare JWT. No synchronous call to Google on each login.
      def google
        credential = params[:credential]
        return render_error("MISSING_CREDENTIAL", "Google credential is required", status: :bad_request) if credential.blank?

        google_payload = verify_google_token(credential)
        return render_error("INVALID_CREDENTIAL", "Google token verification failed", status: :unauthorized) if google_payload.nil?

        email = google_payload["email"]&.downcase
        name  = google_payload["name"].presence || email.split("@").first
        uid   = google_payload["sub"]

        user = find_or_create_oauth_user(email: email, name: name, uid: uid, provider: "google")
        return render_error("OAUTH_FAILED", "Unable to sign in with Google", status: :unprocessable_entity) if user.nil?

        token, _payload = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
        response.set_header("Authorization", "Bearer #{token}")

        admin_email = ENV["SUPER_ADMIN_EMAIL"].to_s.strip
        render json: {
          data: {
            id:                       user.id,
            email:                    user.email,
            name:                     user.name,
            subscription_tier:        user.subscription_tier,
            is_super_admin:           admin_email.present? && user.email == admin_email,
            created_at:               user.created_at,
            notification_preferences: user.notification_preferences
          }
        }, status: :ok
      end

      private

      # Verifies a Google ID token by calling Google's tokeninfo endpoint.
      # Returns the payload hash on success, nil on any failure.
      def verify_google_token(credential)
        uri  = URI("https://oauth2.googleapis.com/tokeninfo")
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl      = true
        http.open_timeout = 5
        http.read_timeout = 5

        resp = http.get("/tokeninfo?id_token=#{URI.encode_www_form_component(credential)}")

        unless resp.is_a?(Net::HTTPSuccess)
          Rails.logger.error("[OauthController] tokeninfo #{resp.code}: #{resp.body.truncate(200)}")
          return nil
        end

        payload = JSON.parse(resp.body)

        unless GOOGLE_ISSUERS.include?(payload["iss"])
          Rails.logger.error("[OauthController] iss mismatch: #{payload['iss']}")
          return nil
        end

        unless payload["aud"] == ENV["GOOGLE_CLIENT_ID"]
          Rails.logger.error("[OauthController] aud mismatch: #{payload['aud']} vs #{ENV['GOOGLE_CLIENT_ID']&.truncate(30)}")
          return nil
        end

        unless payload["email_verified"] == "true" || payload["email_verified"] == true
          Rails.logger.error("[OauthController] email_verified is false for sub=#{payload['sub']}")
          return nil
        end

        payload
      rescue StandardError => e
        Rails.logger.error("[OauthController] tokeninfo error: #{e.class} #{e.message}")
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
