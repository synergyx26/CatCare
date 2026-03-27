module Api
  module V1
    class UsersController < BaseController
      # GET /api/v1/me — return the currently authenticated user
      def me
        render json: {
          data: {
            id:                current_user.id,
            email:             current_user.email,
            name:              current_user.name,
            subscription_tier: current_user.subscription_tier,
            is_super_admin:    super_admin?,
            created_at:        current_user.created_at
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

      private

      def super_admin?
        admin_email = ENV["SUPER_ADMIN_EMAIL"].to_s.strip
        admin_email.present? && current_user.email == admin_email
      end
    end
  end
end
