class ProcessPendingRemindersJob < ApplicationJob
  queue_as :reminders

  # Maps reminder care_type → notification_preferences email key
  PREFERENCE_KEY = {
    "feeding"   => "care_reminders",
    "litter"    => "care_reminders",
    "water"     => "care_reminders",
    "weight"    => "care_reminders",
    "note"      => "care_reminders",
    "medication" => "medication_alerts",
    "vet_visit" => "vet_appointments",
    "grooming"  => "vet_appointments",
  }.freeze

  def perform
    Reminder
      .where(active: true)
      .where("next_trigger_at <= ?", Time.current)
      .includes(:cat, :reminder_recipients, household: { household_memberships: :user })
      .find_each do |reminder|
        process_reminder(reminder)
      rescue => e
        Sentry.capture_exception(e, extra: { reminder_id: reminder.id }) if defined?(Sentry)
        Rails.logger.error("ProcessPendingRemindersJob error for reminder #{reminder.id}: #{e.message}")
      end
  end

  private

  def process_reminder(reminder)
    cats_for_reminder(reminder).each do |cat|
      fire_for_cat(reminder, cat)
    end

    # Always advance the schedule, even when all cats are suppressed
    reminder.update_columns(
      last_triggered_at: Time.current,
      next_trigger_at:   reminder.calculate_next_trigger_at(after_fire: true)
    )
  end

  def fire_for_cat(reminder, cat)
    today_start = Time.current.utc.beginning_of_day
    today_end   = Time.current.utc.end_of_day

    already_logged = CareEvent.exists?(
      cat_id:     cat.id,
      event_type: CareEvent.event_types[reminder.care_type],
      occurred_at: today_start..today_end
    )
    return if already_logged

    recipients_for(reminder).each do |user|
      next unless email_enabled_for?(user, reminder.care_type)
      UserMailer.reminder_notification(reminder, user, cat).deliver_later
    end
  end

  def cats_for_reminder(reminder)
    if reminder.all_cats?
      reminder.household.cats.where(active: true)
    else
      [reminder.cat].compact
    end
  end

  def recipients_for(reminder)
    if reminder.notify_all_members
      reminder.household.household_memberships
              .where(status: :active)
              .includes(:user)
              .map(&:user)
    else
      reminder.reminder_recipients.includes(:user).map(&:user)
    end
  end

  def email_enabled_for?(user, care_type)
    prefs = user.notification_preferences || {}
    email = prefs["email"] || {}
    return false unless email["enabled"]

    pref_key = PREFERENCE_KEY[care_type.to_s]
    return true if pref_key.nil?

    email[pref_key] != false
  end
end
