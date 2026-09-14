module Api
  module V1
    module Admin
      class HouseholdsController < BaseController
        # GET /api/v1/admin/households
        #
        # Unscoped, platform-wide household list — unlike the regular
        # households#index (scoped to current_user's own memberships), this
        # is every household on the instance, for the admin "create user"
        # household picker. Admin-only (Admin::BaseController), so no Pundit
        # scoping, same as the rest of this namespace.
        def index
          households = Household.order(:name).select(:id, :name)
          render json: { data: households.map { |h| { id: h.id, name: h.name } } }
        end
      end
    end
  end
end
