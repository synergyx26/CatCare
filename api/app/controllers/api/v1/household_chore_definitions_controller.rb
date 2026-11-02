module Api
  module V1
    class HouseholdChoreDefinitionsController < BaseController
      before_action :set_household

      # GET /api/v1/households/:household_id/chore_definitions
      def index
        authorize @household, policy_class: HouseholdChoreDefinitionPolicy
        definitions = @household.household_chore_definitions.ordered
        render_success(definitions.map { |d| serialize_definition(d) })
      end

      # POST /api/v1/households/:household_id/chore_definitions
      def create
        definition = @household.household_chore_definitions.build(create_params)
        definition.position = (@household.household_chore_definitions.maximum(:position) || -1) + 1 if definition.position.zero?
        authorize definition

        if definition.save
          notify_household_of(definition)
          render_success(serialize_definition(definition), status: :created)
        else
          render_error("VALIDATION_ERROR", definition.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      # PATCH /api/v1/households/:household_id/chore_definitions/:id
      def update
        definition = @household.household_chore_definitions.find(params[:id])
        authorize definition

        if definition.update(update_params)
          render_success(serialize_definition(definition))
        else
          render_error("VALIDATION_ERROR", definition.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      # PATCH /api/v1/households/:household_id/chore_definitions/reorder
      # Body: { ids: [3, 1, 2] } — the complete list of definition ids in the new order.
      def reorder
        authorize @household, :reorder?, policy_class: HouseholdChoreDefinitionPolicy
        definitions = @household.household_chore_definitions
        ids = Array(params[:ids]).map(&:to_i)

        if ids.uniq.sort != definitions.pluck(:id).sort
          return render_error("VALIDATION_ERROR", "ids must list every chore exactly once",
                              status: :unprocessable_entity)
        end

        HouseholdChoreDefinition.transaction do
          ids.each_with_index { |id, index| definitions.where(id: id).update_all(position: index, updated_at: Time.current) }
        end
        render_success(definitions.ordered.map { |d| serialize_definition(d) })
      end

      # DELETE /api/v1/households/:household_id/chore_definitions/:id
      def destroy
        definition = @household.household_chore_definitions.find(params[:id])
        authorize definition
        definition.destroy
        render_success({ deleted: true })
      end

      private

      def set_household
        @household = current_household
      end

      def create_params
        params.require(:household_chore_definition).permit(:name, :emoji, :active, :position, :frequency_per_day, :location)
      end

      def update_params
        params.require(:household_chore_definition).permit(:name, :emoji, :active, :position, :frequency_per_day, :location)
      end

      def serialize_definition(definition)
        {
          id:               definition.id,
          household_id:     definition.household_id,
          name:             definition.name,
          emoji:            definition.emoji,
          active:           definition.active,
          position:         definition.position,
          frequency_per_day: definition.frequency_per_day,
          location:         definition.location,
          created_at:       definition.created_at,
        }
      end
    end
  end
end
