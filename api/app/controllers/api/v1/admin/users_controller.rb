module Api
  module V1
    module Admin
      class UsersController < BaseController
        VALID_TIERS = User::SUBSCRIPTION_TIERS
        VALID_ROLES = HouseholdMembership.roles.keys

        # POST /api/v1/admin/users
        #
        # Creates a User and, in the same transaction, a HouseholdMembership
        # attaching them to the given household — the admin console's answer
        # to "add someone without a working invite email" (previously a
        # manual `rails console` workaround, see the Proxmox homelab
        # README's "Adding local users" section). Works the same on every
        # deployment: email is required unless this instance has opted into
        # LOCAL_ACCOUNTS_ENABLED (see User.local_accounts_enabled?) — the
        # same rule registration already follows. No tier limits enforced
        # here, matching the existing CSV import path
        # (Admin::ImportsController): admin actions bypass the tier gates
        # that exist to guide self-serve users, not to constrain the admin.
        def create
          household = Household.find(params[:household_id])
          role = params[:role].presence || "member"

          unless VALID_ROLES.include?(role)
            return render json: { error: "INVALID_ROLE", message: "Invalid role" },
                          status: :unprocessable_entity
          end

          password = params[:password].presence || SecureRandom.base58(16)

          user = User.new(
            name: params[:name],
            email: params[:email].presence,
            password: password,
            password_confirmation: password
          )

          ActiveRecord::Base.transaction do
            user.save!
            HouseholdMembership.create!(household: household, user: user, role: role, status: :active)
          end

          render json: { data: serialize_user(user).merge(password: password) }, status: :created
        rescue ActiveRecord::RecordNotFound
          render json: { error: "NOT_FOUND", message: "Household not found" }, status: :not_found
        rescue ActiveRecord::RecordInvalid => e
          render json: { error: "CREATE_FAILED", message: e.record.errors.full_messages.join(", ") },
                        status: :unprocessable_entity
        end

        # GET /api/v1/admin/users?page=1&per=25&search=foo&tier=free
        def index
          scope = User.all

          if params[:search].present?
            term = "%#{params[:search].strip}%"
            scope = scope.where("name ILIKE ? OR email ILIKE ?", term, term)
          end

          if params[:tier].present? && VALID_TIERS.include?(params[:tier])
            scope = scope.where(subscription_tier: params[:tier])
          end

          scope = scope.order(created_at: :desc)

          per_page = [[params[:per].to_i, 1].max, 100].min
          per_page = 25 if per_page == 0
          page     = [params[:page].to_i, 1].max
          total    = scope.count
          users    = scope.offset((page - 1) * per_page).limit(per_page)

          render json: {
            data: users.map { |u| serialize_user(u) },
            meta: {
              total:    total,
              page:     page,
              per:      per_page,
              pages:    (total.to_f / per_page).ceil
            }
          }
        end

        # PATCH /api/v1/admin/users/:id
        def update
          user = User.find(params[:id])
          tier = params[:subscription_tier].to_s

          unless VALID_TIERS.include?(tier)
            return render json: { error: "INVALID_TIER", message: "Invalid subscription tier" },
                          status: :unprocessable_entity
          end

          user.update!(subscription_tier: tier)
          render json: { data: serialize_user(user) }
        end

        # DELETE /api/v1/admin/users/:id
        #
        # Same erasure rules as the self-service GDPR flow — see
        # User#erase!. No password check here: authority comes from
        # super_admin? (enforced by Admin::BaseController), not the user's
        # own credentials.
        def destroy
          user = User.find(params[:id])

          if user.id == current_user.id
            return render json: {
              error: "CANNOT_DELETE_SELF",
              message: "Use your account settings to delete your own account."
            }, status: :unprocessable_entity
          end

          user.erase!
          head :no_content
        end

        # POST /api/v1/admin/users/:id/reset_password
        #
        # Self-hosted instances can't rely on outbound email for Devise's
        # :recoverable flow (Resend's shared sender only delivers to the
        # Resend account owner — see CLAUDE.md). This lets the super admin
        # set a user's password directly instead. base58 avoids visually
        # ambiguous characters (0/O, 1/l/I) when relaying the password to
        # the user by hand.
        def reset_password
          user = User.find(params[:id])
          new_password = params[:password].presence || SecureRandom.base58(16)

          user.password = new_password
          user.password_confirmation = new_password
          user.save!

          render json: { data: { id: user.id, email: user.email, password: new_password } }
        rescue ActiveRecord::RecordInvalid => e
          render json: { error: "INVALID_PASSWORD", message: e.record.errors.full_messages.join(", ") },
                        status: :unprocessable_entity
        end

        private

        def serialize_user(user)
          {
            id:                user.id,
            name:              user.name,
            email:             user.email,
            subscription_tier: user.subscription_tier,
            provider:          user.provider,
            household_count:   user.households.count,
            created_at:        user.created_at
          }
        end
      end
    end
  end
end
