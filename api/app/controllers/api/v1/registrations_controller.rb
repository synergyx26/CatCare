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
              email: user.public_email,
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

      # :email is optional — the local-accounts flow (deployments with
      # LOCAL_ACCOUNTS_ENABLED set, see User.local_accounts_enabled?) omits
      # it entirely and User#assign_local_placeholder_email fills in a unique
      # placeholder so Devise's validations and the DB's unique index are
      # still satisfied. See User::LOCAL_ACCOUNT_EMAIL_DOMAIN.
      def registration_params
        params.require(:user).permit(:email, :password, :password_confirmation, :name)
      end
    end
  end
end
