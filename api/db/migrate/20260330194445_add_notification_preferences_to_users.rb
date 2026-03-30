class AddNotificationPreferencesToUsers < ActiveRecord::Migration[8.1]
  DEFAULT_PREFS = {
    "in_app" => {
      "enabled"           => true,
      "position"          => "top-right",
      "duration"          => 4000,
      "success_toasts"    => true,
      "error_toasts"      => true,
      "tier_limit_toasts" => true
    },
    "email" => {
      "enabled"           => true,
      "care_reminders"    => true,
      "medication_alerts" => true,
      "vet_appointments"  => true
    },
    "push" => {
      "enabled"           => false,
      "care_reminders"    => true,
      "medication_alerts" => true,
      "vet_appointments"  => true
    }
  }.freeze

  def change
    add_column :users, :notification_preferences, :jsonb,
               default: DEFAULT_PREFS, null: false
  end
end
