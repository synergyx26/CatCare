module Api
  module V1
    class HouseholdsController < BaseController
      before_action :set_household, only: [:show, :update]

      # GET /api/v1/households
      def index
        households = current_user.households.includes(:cats, :members, :household_memberships)
        render json: {
          data: households.map { |h| household_json(h) }
        }
      end

      # GET /api/v1/households/:id
      def show
        authorize @household
        render json: { data: household_json(@household) }
      end

      # PATCH /api/v1/households/:id
      def update
        authorize @household
        if @household.update(household_params)
          render json: { data: household_json(@household) }
        else
          render json: {
            error: "UPDATE_FAILED",
            message: @household.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/households
      def create
        household = current_user.households.build(household_params)
        household.created_by = current_user.id

        if household.save
          # Creator becomes an admin member automatically
          household.household_memberships.create!(
            user: current_user,
            role: 1, # admin
            status: 1, # active
            joined_at: Time.current
          )
          render json: { data: household_json(household) }, status: :created
        else
          render json: {
            error: "CREATE_FAILED",
            message: household.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      private

      def set_household
        @household = current_user.households.find(params[:id])
      end

      def household_params
        params.require(:household).permit(:name, :emergency_contact_name, :emergency_contact_phone)
      end

      def household_json(household)
        memberships = household.household_memberships.select { |m| m.status == "active" }.index_by(&:user_id)
        {
          id:           household.id,
          name:         household.name,
          created_by:   household.created_by,
          member_count: household.household_memberships.size,
          members:      household.members.map { |m|
            { id: m.id, name: m.name, role: memberships[m.id]&.role, membership_id: memberships[m.id]&.id }
          },
          cat_count:    household.cats.active.size,
          created_at:   household.created_at,
          emergency_contact_name:  household.emergency_contact_name,
          emergency_contact_phone: household.emergency_contact_phone,
        }
      end
    end
  end
end
