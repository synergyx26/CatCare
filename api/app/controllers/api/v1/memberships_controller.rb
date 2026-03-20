module Api
  module V1
    class MembershipsController < BaseController
      before_action :set_membership,        only: [:show, :update]
      before_action :set_target_membership, only: [:manage_update, :manage_destroy]

      # GET /api/v1/households/:household_id/membership
      def show
        authorize @membership
        render_success(membership_json(@membership))
      end

      # PATCH /api/v1/households/:household_id/membership
      def update
        authorize @membership
        if @membership.update(membership_params)
          render_success(membership_json(@membership))
        else
          render_error("UPDATE_FAILED", @membership.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      # PATCH /api/v1/households/:household_id/memberships/:id
      def manage_update
        authorize @target_membership
        new_role = params.require(:membership).permit(:role)[:role]

        # Guard: cannot leave the household with zero admins
        if @target_membership.admin? && new_role != "admin"
          remaining_admins = current_household.household_memberships
            .where(role: :admin, status: :active)
            .where.not(id: @target_membership.id)
            .count
          if remaining_admins.zero?
            return render_error("LAST_ADMIN", "Cannot demote the last admin of a household.", status: :unprocessable_entity)
          end
        end

        if @target_membership.update(role: new_role)
          render_success(membership_json(@target_membership))
        else
          render_error("UPDATE_FAILED", @target_membership.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      # DELETE /api/v1/households/:household_id/memberships/:id
      def manage_destroy
        authorize @target_membership

        # Guard: cannot remove the last admin
        if @target_membership.admin?
          remaining_admins = current_household.household_memberships
            .where(role: :admin, status: :active)
            .where.not(id: @target_membership.id)
            .count
          if remaining_admins.zero?
            return render_error("LAST_ADMIN", "Cannot remove the last admin of a household.", status: :unprocessable_entity)
          end
        end

        @target_membership.update!(status: :removed)
        render_success({ id: @target_membership.id })
      end

      private

      def set_membership
        @membership = current_household.household_memberships.find_by!(user: current_user)
      end

      def set_target_membership
        @target_membership = current_household.household_memberships.find(params[:id])
      end

      def membership_params
        params.require(:membership).permit(
          :phone,
          :emergency_contact_name,
          :emergency_contact_phone,
          :notes
        )
      end

      def membership_json(m)
        {
          id:                      m.id,
          user_id:                 m.user_id,
          household_id:            m.household_id,
          role:                    m.role,
          phone:                   m.phone,
          emergency_contact_name:  m.emergency_contact_name,
          emergency_contact_phone: m.emergency_contact_phone,
          notes:                   m.notes,
        }
      end
    end
  end
end
