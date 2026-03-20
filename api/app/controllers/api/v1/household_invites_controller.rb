module Api
  module V1
    class HouseholdInvitesController < BaseController
      # The token-based show endpoint is public — no auth needed.
      skip_before_action :authenticate_user!, only: [:show]

      before_action :set_household, only: [:index, :create, :destroy]

      # GET /api/v1/households/:household_id/invites
      # List active invites for a household (admin can see who was invited)
      def index
        authorize @household, policy_class: HouseholdInvitePolicy
        invites = @household.household_invites.where(status: :pending).order(created_at: :desc)
        render_success(invites.map { |i| invite_json(i) })
      end

      # POST /api/v1/households/:household_id/invites
      # Generate a new invite link for the given email address
      def create
        authorize @household, policy_class: HouseholdInvitePolicy
        invite = @household.household_invites.build(
          email:         invite_params[:email],
          invited_by_id: current_user.id,
          role:          invite_params[:role].presence || :member,
        )

        if invite.save
          render_success(invite_json(invite), status: :created)
        else
          render_error("VALIDATION_ERROR", invite.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      # GET /api/v1/invites/:token  (PUBLIC — no auth required)
      # Returns enough info for the invitee to decide whether to accept
      def show
        invite = HouseholdInvite.find_by!(token: params[:token])

        unless invite.usable?
          return render_error("INVITE_INVALID", "This invite link has expired or already been used.", status: :gone)
        end

        render_success({
          token:          invite.token,
          household_name: invite.household.name,
          invited_by:     invite.invited_by.name,
          email:          invite.email,
          expires_at:     invite.expires_at,
        })
      end

      # POST /api/v1/invites/:token/accept  (requires auth)
      # Adds the authenticated user to the household and marks the invite accepted
      def accept
        invite = HouseholdInvite.find_by!(token: params[:token])

        unless invite.usable?
          return render_error("INVITE_INVALID", "This invite has expired or already been used.", status: :gone)
        end

        # Idempotent: don't add a duplicate membership if already a member
        unless current_user.households.exists?(invite.household_id)
          invite.household.household_memberships.create!(
            user:      current_user,
            role:      invite.role,
            status:    :active,
            joined_at: Time.current,
          )
        end

        invite.update!(status: :accepted)
        render_success({ household_id: invite.household_id })
      end

      # DELETE /api/v1/households/:household_id/invites/:id
      # Revoke a pending invite
      def destroy
        authorize @household, policy_class: HouseholdInvitePolicy
        invite = @household.household_invites.find(params[:id])
        invite.update!(status: :expired)
        render_success({ revoked: true })
      end

      private

      def set_household
        @household = current_household
      end

      def invite_params
        params.require(:invite).permit(:email, :role)
      end

      def invite_json(invite)
        {
          id:         invite.id,
          email:      invite.email,
          token:      invite.token,
          status:     invite.status,
          invited_by: invite.invited_by.name,
          expires_at: invite.expires_at,
          created_at: invite.created_at,
        }
      end
    end
  end
end
