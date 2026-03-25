module Api
  module V1
    class CareEventsController < BaseController
      before_action :set_household

      def index
        authorize @household, policy_class: CareEventPolicy
        events = @household.care_events

        events = events.where(cat_id: params[:cat_id]) if params[:cat_id].present?
        events = events.where(event_type: params[:event_types]) if params[:event_types].present?

        if params[:upcoming] == 'true'
          events = events.where('occurred_at > ?', Time.current).order(occurred_at: :asc)
        else
          events = events.order(occurred_at: :desc)
        end

        render_success(events.map { |e| serialize_event(e) })
      end

      def create
        cat   = @household.cats.find(params[:care_event][:cat_id])
        event = @household.care_events.build(create_params)
        event.cat       = cat
        event.logged_by = current_user
        authorize event

        if event.save
          render_success(serialize_event(event), status: :created)
        else
          render_error("VALIDATION_ERROR", event.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      def update
        event = @household.care_events.find(params[:id])
        authorize event

        if event.update(update_params)
          render_success(serialize_event(event))
        else
          render_error("VALIDATION_ERROR", event.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      def destroy
        event = @household.care_events.find(params[:id])
        authorize event
        event.destroy
        render_success({ deleted: true })
      end

      private

      def set_household
        @household = current_household
      end

      def create_params
        permitted = params.require(:care_event).permit(:event_type, :occurred_at, :notes)
        permitted[:details] = params[:care_event][:details]&.to_unsafe_h || {}
        permitted
      end

      def update_params
        permitted = params.require(:care_event).permit(:occurred_at, :notes)
        permitted[:details] = params[:care_event][:details].to_unsafe_h if params[:care_event][:details].present?
        permitted
      end

      def serialize_event(event)
        {
          id: event.id,
          cat_id: event.cat_id,
          household_id: event.household_id,
          logged_by_id: event.logged_by_id,
          event_type: event.event_type,
          occurred_at: event.occurred_at,
          notes: event.notes,
          details: event.details,
          created_at: event.created_at,
        }
      end
    end
  end
end
