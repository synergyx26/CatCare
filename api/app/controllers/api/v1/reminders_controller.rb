module Api
  module V1
    class RemindersController < BaseController
      before_action :set_household

      def index
        authorize @household, policy_class: ReminderPolicy
        reminders = @household.reminders.where(active: true).order(created_at: :desc)
        render_success(reminders.map { |r| serialize_reminder(r) })
      end

      def create
        reminder = @household.reminders.build(reminder_params)
        reminder.created_by_id = current_user.id
        reminder.next_trigger_at = reminder.calculate_next_trigger_at
        authorize reminder

        if reminder.save
          render_success(serialize_reminder(reminder), status: :created)
        else
          render_error("VALIDATION_ERROR", reminder.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      def update
        reminder = @household.reminders.find(params[:id])
        authorize reminder

        # Recompute trigger time when schedule fields change
        attrs = reminder_params.to_h
        reminder.assign_attributes(attrs)
        reminder.next_trigger_at = reminder.calculate_next_trigger_at if schedule_changed?(attrs)

        if reminder.save
          render_success(serialize_reminder(reminder))
        else
          render_error("VALIDATION_ERROR", reminder.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      def destroy
        reminder = @household.reminders.find(params[:id])
        authorize reminder
        reminder.update!(active: false)
        head :no_content
      end

      # POST /api/v1/households/:household_id/reminders/:id/test_send
      # Super-admin only — immediately delivers the reminder email to the requester
      # for each cat the reminder applies to.
      def test_send
        unless super_admin?
          return render_error("FORBIDDEN", "Super admin only", status: :forbidden)
        end

        reminder = @household.reminders.find(params[:id])
        authorize reminder, :show?

        cats = reminder.all_cats? ? @household.cats.where(active: true) : [reminder.cat].compact

        if cats.empty?
          return render_error("NO_CATS", "No active cats found for this reminder", status: :unprocessable_entity)
        end

        cats.each do |cat|
          UserMailer.reminder_notification(reminder, current_user, cat).deliver_later
        end

        render_success({ sent_to: current_user.email, cats: cats.map(&:name) })
      end

      private

      def set_household
        @household = current_household
      end

      def super_admin?
        email = ENV["SUPER_ADMIN_EMAIL"].to_s.strip
        email.present? && current_user.email == email
      end

      def schedule_changed?(attrs)
        (attrs.keys & %w[schedule_type schedule_value]).any?
      end

      def reminder_params
        params.require(:reminder).permit(:cat_id, :all_cats, :care_type, :schedule_type, :schedule_value, :notify_all_members)
      end

      def serialize_reminder(reminder)
        {
          id:              reminder.id,
          cat_id:          reminder.cat_id,
          all_cats:        reminder.all_cats,
          household_id:    reminder.household_id,
          care_type:       reminder.care_type,
          schedule_type:   reminder.schedule_type,
          schedule_value:  reminder.schedule_value,
          active:          reminder.active,
          next_trigger_at: reminder.next_trigger_at,
          created_at:      reminder.created_at,
        }
      end
    end
  end
end
