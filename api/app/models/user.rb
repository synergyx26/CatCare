class User < ApplicationRecord
  include Devise::JWT::RevocationStrategies::JTIMatcher

  devise :database_authenticatable, :registerable,
         :recoverable, :validatable,
         :jwt_authenticatable, jwt_revocation_strategy: self

  has_many :household_memberships, dependent: :destroy
  has_many :households, through: :household_memberships
  has_many :reminder_recipients, dependent: :destroy

  SUBSCRIPTION_TIERS = %w[free pro premium].freeze

  DEFAULT_NOTIFICATION_PREFERENCES = {
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

  VALID_NOTIFICATION_POSITIONS = %w[
    top-left top-center top-right
    bottom-left bottom-center bottom-right
  ].freeze

  VALID_NOTIFICATION_DURATIONS = [ 2000, 4000, 6000, 8000 ].freeze

  validates :name, presence: true
  validates :subscription_tier, inclusion: { in: SUBSCRIPTION_TIERS }
  validate :notification_preferences_shape

  def oauth_user?
    provider.present?
  end

  # Skip Devise's password requirement for OAuth accounts — they have no password.
  def password_required?
    oauth_user? ? false : super
  end

  private

  def notification_preferences_shape
    prefs = notification_preferences
    return errors.add(:notification_preferences, "must be a hash") unless prefs.is_a?(Hash)

    in_app = prefs["in_app"]
    if in_app.is_a?(Hash)
      pos = in_app["position"]
      if pos.present? && !VALID_NOTIFICATION_POSITIONS.include?(pos)
        errors.add(:notification_preferences, "position '#{pos}' is not valid")
      end
      dur = in_app["duration"]
      if !dur.nil? && !VALID_NOTIFICATION_DURATIONS.include?(dur)
        errors.add(:notification_preferences, "duration #{dur} is not valid")
      end
    end
  end
end
