module Api
  module V1
    class HouseholdChoresController < BaseController
      before_action :set_household

      # GET /api/v1/households/:household_id/chores
      def index
        authorize @household, policy_class: HouseholdChorePolicy
        chores = @household.household_chores

        if params[:chore_definition_id].present?
          chores = chores.where(chore_definition_id: params[:chore_definition_id])
        end

        if params[:start_date].present?
          chores = chores.where("occurred_at >= ?", Time.zone.parse(params[:start_date]).beginning_of_day)
        end
        if params[:end_date].present?
          chores = chores.where("occurred_at <= ?", Time.zone.parse(params[:end_date]).end_of_day)
        end
        if params[:logged_by_id].present?
          chores = chores.where(logged_by_id: params[:logged_by_id])
        end

        chores = chores.order(occurred_at: :desc)
        render_success(chores.map { |c| serialize_chore(c) })
      end

      # POST /api/v1/households/:household_id/chores
      def create
        chore = @household.household_chores.build(create_params)
        chore.logged_by = current_user
        authorize chore

        if chore.save
          render_success(serialize_chore(chore), status: :created)
        else
          render_error("VALIDATION_ERROR", chore.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      # PATCH /api/v1/households/:household_id/chores/:id
      def update
        chore = @household.household_chores.find(params[:id])
        authorize chore

        if chore.update(update_params)
          render_success(serialize_chore(chore))
        else
          render_error("VALIDATION_ERROR", chore.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      # DELETE /api/v1/households/:household_id/chores/:id
      def destroy
        chore = @household.household_chores.find(params[:id])
        authorize chore
        chore.destroy
        render_success({ deleted: true })
      end

      private

      def set_household
        @household = current_household
      end

      def create_params
        params.require(:household_chore).permit(:chore_definition_id, :occurred_at, :notes)
      end

      def update_params
        params.require(:household_chore).permit(:occurred_at, :notes)
      end

      def serialize_chore(chore)
        {
          id:                   chore.id,
          household_id:         chore.household_id,
          logged_by_id:         chore.logged_by_id,
          chore_definition_id:  chore.chore_definition_id,
          occurred_at:          chore.occurred_at,
          notes:                chore.notes,
          created_at:           chore.created_at,
        }
      end
    end
  end
end
