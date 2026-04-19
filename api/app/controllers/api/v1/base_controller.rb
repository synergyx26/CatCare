module Api
  module V1
    class BaseController < ApplicationController
      TIER_RANK = { "free" => 0, "pro" => 1, "premium" => 2 }.freeze

      private

      def render_success(data, status: :ok, meta: {})
        render json: { data: data, meta: meta }, status: status
      end

      def render_error(code, message, status:)
        render json: { error: code, message: message }, status: status
      end

      def current_household
        @current_household ||= current_user.households.find(params[:household_id])
      end

      # Returns the subscription tier that applies to the current user within
      # the current household. Sitters inherit the highest tier among non-sitter
      # active members of that household. Admins and members always use their own tier.
      def effective_tier
        @effective_tier ||= begin
          my_membership = current_household.household_memberships
                                           .find_by(user_id: current_user.id, status: :active)
          if my_membership&.sitter?
            non_sitter_ids = current_household.household_memberships
                                              .active
                                              .where.not(role: :sitter)
                                              .pluck(:user_id)
            if non_sitter_ids.empty?
              current_user.subscription_tier
            else
              tiers = User.where(id: non_sitter_ids).pluck(:subscription_tier)
              tiers.max_by { |t| TIER_RANK[t] || 0 } || "free"
            end
          else
            current_user.subscription_tier
          end
        end
      end
    end
  end
end
