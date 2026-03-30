module Api
  module V1
    class UsersController < BaseController
      # GET /api/v1/me — return the currently authenticated user
      def me
        render json: {
          data: {
            id:                       current_user.id,
            email:                    current_user.email,
            name:                     current_user.name,
            subscription_tier:        current_user.subscription_tier,
            is_super_admin:           super_admin?,
            created_at:               current_user.created_at,
            notification_preferences: current_user.notification_preferences
          }
        }
      end

      # PATCH /api/v1/me/subscription_tier — super admin only
      def update_subscription_tier
        unless super_admin?
          return render_error("FORBIDDEN", "Not authorized", status: :forbidden)
        end

        tier = params[:subscription_tier].to_s
        unless User::SUBSCRIPTION_TIERS.include?(tier)
          return render_error("INVALID_TIER", "Invalid subscription tier", status: :unprocessable_entity)
        end

        current_user.update!(subscription_tier: tier)
        render json: { data: { subscription_tier: current_user.subscription_tier } }
      end

      # PATCH /api/v1/me/notification_preferences
      def update_notification_preferences
        authorize current_user, policy_class: UserPolicy

        merged = current_user.notification_preferences
                              .deep_merge(notification_preferences_params.to_h)

        if current_user.update(notification_preferences: merged)
          render json: { data: { notification_preferences: current_user.notification_preferences } }
        else
          render_error(
            "UPDATE_FAILED",
            current_user.errors.full_messages.join(", "),
            status: :unprocessable_entity
          )
        end
      end

      private

      def super_admin?
        admin_email = ENV["SUPER_ADMIN_EMAIL"].to_s.strip
        admin_email.present? && current_user.email == admin_email
      end

      def notification_preferences_params
        params.require(:notification_preferences).permit(
          in_app: [ :enabled, :position, :duration, :success_toasts, :error_toasts, :tier_limit_toasts ],
          email:  [ :enabled, :care_reminders, :medication_alerts, :vet_appointments ],
          push:   [ :enabled, :care_reminders, :medication_alerts, :vet_appointments ]
        )
      end
    end
  end
end
