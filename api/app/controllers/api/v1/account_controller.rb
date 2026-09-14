module Api
  module V1
    class AccountController < BaseController
      before_action :authenticate_user!

      # DELETE /api/v1/account
      #
      # GDPR Article 17 — Right to Erasure. Deletion strategy lives on
      # User#erase! (shared with admin-initiated deletion) — see there.
      #
      # Password is required for email/password accounts so a stolen session
      # cannot silently wipe a user's data. OAuth accounts skip this check —
      # their Google token already provides strong authentication.
      def destroy
        unless current_user.oauth_user?
          password = params[:password].to_s
          if password.blank? || !current_user.valid_password?(password)
            return render_error("INVALID_PASSWORD", "Incorrect password.", status: :unprocessable_entity)
          end
        end

        current_user.erase!
        head :no_content
      end
    end
  end
end
