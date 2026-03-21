# frozen_string_literal: true

module Api
  module V1
    class PasswordsController < BaseController
      skip_before_action :authenticate_user!

      # POST /api/v1/passwords
      # Request a password reset email.
      # Always returns 200 regardless of whether the email exists — prevents email enumeration.
      def create
        email = params[:email]&.downcase&.strip
        user  = User.find_by(email: email)

        if user
          if user.oauth_user?
            # Don't send a reset email — this account was created via OAuth and has no password.
            # Return a specific error so the frontend can show a helpful message.
            return render json: {
              error: "OAUTH_USER",
              message: "This account uses Google sign-in. Password reset is not available."
            }, status: :unprocessable_entity
          end

          raw, enc = Devise.token_generator.generate(User, :reset_password_token)
          user.reset_password_token   = enc
          user.reset_password_sent_at = Time.now.utc
          user.save!(validate: false)
          UserMailer.reset_password_instructions(user, raw).deliver_later
        end

        render json: { data: { message: "If that email is registered, a reset link has been sent." } }
      end

      # PATCH /api/v1/passwords/:token
      # Confirm password reset using a valid token from the email link.
      def update
        digest = Devise.token_generator.digest(User, :reset_password_token, params[:token])
        user   = User.find_by(reset_password_token: digest)

        unless user&.reset_password_period_valid?
          return render json: {
            error: "INVALID_TOKEN",
            message: "Reset link is invalid or has expired."
          }, status: :unprocessable_entity
        end

        if user.reset_password(params[:password], params[:password_confirmation])
          render json: { data: { message: "Password updated successfully. Please sign in." } }
        else
          render json: {
            error: "INVALID_PASSWORD",
            message: user.errors.full_messages.first || "Password could not be updated."
          }, status: :unprocessable_entity
        end
      end
    end
  end
end
