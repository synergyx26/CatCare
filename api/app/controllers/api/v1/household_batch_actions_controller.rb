module Api
  module V1
    class HouseholdBatchActionsController < BaseController
      before_action :set_household

      def index
        authorize @household, policy_class: HouseholdBatchActionPolicy
        render_success(@household.household_batch_actions.map { |a| serialize(a) })
      end

      def create
        action = @household.household_batch_actions.build(action_params)
        authorize action

        if action.save
          render_success(serialize(action), status: :created)
        else
          render_error("VALIDATION_ERROR", action.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      def update
        action = @household.household_batch_actions.find(params[:id])
        authorize action

        if action.update(action_params)
          render_success(serialize(action))
        else
          render_error("VALIDATION_ERROR", action.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      def destroy
        action = @household.household_batch_actions.find(params[:id])
        authorize action
        action.destroy
        render_success({ deleted: true })
      end

      private

      def set_household
        @household = current_household
      end

      def action_params
        permitted = params.require(:household_batch_action)
                         .permit(:label, :event_type, :default_notes, :position)
        permitted[:details] = params[:household_batch_action][:details]&.to_unsafe_h || {}
        permitted
      end

      def serialize(action)
        {
          id:            action.id,
          label:         action.label,
          event_type:    action.event_type,
          details:       action.details,
          default_notes: action.default_notes,
          position:      action.position,
        }
      end
    end
  end
end
