module Api
  module V1
    class AccountController < BaseController
      before_action :authenticate_user!

      # DELETE /api/v1/account
      #
      # GDPR Article 17 — Right to Erasure.
      #
      # Deletion strategy:
      #   1. For each household where this user is the only active member:
      #      destroy the whole household (cascades cats, events, etc.)
      #   2. For surviving households: promote another admin if needed, then
      #      anonymise every record attributed to this user (NULL the reference
      #      rather than deleting household data other members rely on).
      #   3. Destroy the user — Rails cascades household_memberships and
      #      reminder_recipients via dependent: :destroy.
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

        ActiveRecord::Base.transaction do
          current_user.household_memberships.active.includes(:household).each do |membership|
            household = membership.household
            other_active = household.household_memberships.active.where.not(user_id: current_user.id)

            if other_active.empty?
              household.destroy!
            else
              if membership.admin? && other_active.where(role: :admin).empty?
                next_admin = other_active.where.not(role: :sitter).first || other_active.first
                next_admin.update!(role: :admin)
              end
              anonymise_in_household(household.id, current_user.id)
            end
          end

          current_user.destroy!
        end

        head :no_content
      end

      private

      def anonymise_in_household(household_id, user_id)
        CareEvent.where(household_id: household_id, logged_by_id: user_id)
                 .update_all(logged_by_id: nil)
        CareNote.where(household_id: household_id, created_by_id: user_id)
                .update_all(created_by_id: nil)
        Cat.where(household_id: household_id, created_by_id: user_id)
           .update_all(created_by_id: nil)
        HouseholdChore.where(household_id: household_id, logged_by_id: user_id)
                      .update_all(logged_by_id: nil)
        PetExpense.where(household_id: household_id, created_by_id: user_id)
                  .update_all(created_by_id: nil)
        VacationTrip.where(household_id: household_id, created_by_id: user_id)
                    .update_all(created_by_id: nil)
      end
    end
  end
end
