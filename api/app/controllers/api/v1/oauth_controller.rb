# frozen_string_literal: true

require "net/http"
require "json"

module Api
  module V1
    class OauthController < BaseController
      skip_before_action :authenticate_user!

      # POST /api/v1/auth/google
      # Accepts a Google ID token from the React frontend (via @react-oauth/google).
      # Verifies it with Google, then finds or creates a User and returns a CatCare JWT.
      def google
        credential = params[:credential]
        return render_error("MISSING_CREDENTIAL", "Google credential is required", :bad_request) if credential.blank?

        google_payload = verify_google_token(credential)
        return render_error("INVALID_CREDENTIAL", "Google token verification failed", :unauthorized) if google_payload.nil?

        # Validate the token was issued for our app
        unless google_payload["aud"] == ENV["GOOGLE_CLIENT_ID"]
          return render_error("INVALID_CREDENTIAL", "Google token audience mismatch", :unauthorized)
        end

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

      # Calls Google's tokeninfo endpoint to verify the ID token.
      # Returns the parsed payload hash on success, nil on failure.
      def verify_google_token(credential)
        uri      = URI("https://oauth2.googleapis.com/tokeninfo")
        uri.query = URI.encode_www_form(id_token: credential)
        response  = Net::HTTP.get_response(uri)

        return nil unless response.is_a?(Net::HTTPSuccess)

        payload = JSON.parse(response.body)
        # Reject tokens with error fields (expired, invalid signature, etc.)
        payload["error"].present? ? nil : payload
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
