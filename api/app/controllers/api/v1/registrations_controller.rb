module Api
  module V1
    class RegistrationsController < BaseController
      skip_before_action :authenticate_user!

      def create
        user = User.new(registration_params)
        if user.save
          token, _payload = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
          response.set_header('Authorization', "Bearer #{token}")
          render json: {
            data: {
              id: user.id,
              email: user.email,
              name: user.name
            }
          }, status: :created
        else
          render json: {
            error: "REGISTRATION_FAILED",
            message: user.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      private

      def registration_params
        params.require(:user).permit(:email, :password, :password_confirmation, :name)
      end
    end
  end
end
