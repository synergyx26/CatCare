module Api
  module V1
    class RemindersController < BaseController
      before_action :set_household

      def index
        reminders = @household.reminders.where(active: true).order(created_at: :desc)
        render_success(reminders.map { |r| serialize_reminder(r) })
      end

      def create
        reminder = @household.reminders.build(reminder_params)
        reminder.created_by_id = current_user.id

        if reminder.save
          render_success(serialize_reminder(reminder), status: :created)
        else
          render_error("VALIDATION_ERROR", reminder.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      def destroy
        reminder = @household.reminders.find(params[:id])
        reminder.update!(active: false)
        head :no_content
      end

      private

      def set_household
        @household = current_household
      end

      def reminder_params
        params.require(:reminder).permit(:cat_id, :care_type, :schedule_type, :schedule_value, :notify_all_members)
      end

      def serialize_reminder(reminder)
        {
          id: reminder.id,
          cat_id: reminder.cat_id,
          household_id: reminder.household_id,
          care_type: reminder.care_type,
          schedule_type: reminder.schedule_type,
          schedule_value: reminder.schedule_value,
          active: reminder.active,
          next_trigger_at: reminder.next_trigger_at,
          created_at: reminder.created_at,
        }
      end
    end
  end
end
