module Api
  module V1
    module Admin
      class UsersController < BaseController
        VALID_TIERS = User::SUBSCRIPTION_TIERS

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
