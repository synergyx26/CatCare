module Api
  module V1
    class SessionsController < BaseController
      skip_before_action :authenticate_user!, only: [:create]

      # POST /api/v1/sessions — login
      # devise-jwt middleware intercepts the Warden sign_in and adds the JWT
      # to the Authorization response header automatically.
      #
      # `identifier` is an email by default. On a deployment with
      # LOCAL_ACCOUNTS_ENABLED set it may also be a name, matching the local
      # (no-email) accounts created via RegistrationsController — see
      # User.local_accounts_enabled? and User#local_account?.
      def create
        identifier = params.dig(:user, :identifier).to_s.strip
        user = find_user(identifier)

        if user&.valid_password?(params.dig(:user, :password))
          token, _payload = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
          response.set_header('Authorization', "Bearer #{token}")
          render json: {
            data: {
              id:                user.id,
              email:             user.public_email,
              name:              user.name,
              subscription_tier: user.subscription_tier,
              is_super_admin:    User.super_admin_email?(user.email)
            }
          }, status: :ok
        else
          render json: {
            error: "INVALID_CREDENTIALS",
            message: User.local_accounts_enabled? ? "Invalid name/email or password" : "Invalid email or password"
          }, status: :unauthorized
        end
      end

      # DELETE /api/v1/sessions — logout (invalidates the token via JTI rotation)
      def destroy
        current_user.update!(jti: SecureRandom.uuid)
        head :no_content
      end

      private

      def find_user(identifier)
        return nil if identifier.blank?

        if User.local_accounts_enabled?
          User.find_by(email: identifier.downcase) ||
            User.find_by("lower(name) = ?", identifier.downcase)
        else
          User.find_by(email: identifier.downcase)
        end
      end
    end
  end
end
