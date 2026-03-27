module Api
  module V1
    class SessionsController < BaseController
      skip_before_action :authenticate_user!, only: [:create]

      # POST /api/v1/sessions — login
      # devise-jwt middleware intercepts the Warden sign_in and adds the JWT
      # to the Authorization response header automatically.
      def create
        user = User.find_by(email: params.dig(:user, :email)&.downcase)
        if user&.valid_password?(params.dig(:user, :password))
          token, _payload = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
          response.set_header('Authorization', "Bearer #{token}")
          admin_email = ENV["SUPER_ADMIN_EMAIL"].to_s.strip
          render json: {
            data: {
              id:                user.id,
              email:             user.email,
              name:              user.name,
              subscription_tier: user.subscription_tier,
              is_super_admin:    admin_email.present? && user.email == admin_email
            }
          }, status: :ok
        else
          render json: {
            error: "INVALID_CREDENTIALS",
            message: "Invalid email or password"
          }, status: :unauthorized
        end
      end

      # DELETE /api/v1/sessions — logout (invalidates the token via JTI rotation)
      def destroy
        current_user.update!(jti: SecureRandom.uuid)
        head :no_content
      end
    end
  end
end
