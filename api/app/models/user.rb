class User < ApplicationRecord
  include Devise::JWT::RevocationStrategies::JTIMatcher

  devise :database_authenticatable, :registerable,
         :recoverable, :validatable, :lockable,
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

  # Local accounts (see LOCAL_ACCOUNT_EMAIL_DOMAIN below) log in by name
  # instead of email, so name has to be unambiguous — but only when the
  # LOCAL_ACCOUNTS_ENABLED env var opts a deployment in; a deployment that
  # hasn't opted in allows multiple members to share a display name, as
  # before. Rails.env.development? was the wrong test here: a self-hosted
  # box (e.g. the Proxmox LXC) runs RAILS_ENV=production too, same as the
  # Render cloud deployment, so only an explicit opt-in can tell them apart.
  validates :name, presence: true
  validates :name, uniqueness: { case_sensitive: false }, if: -> { User.local_accounts_enabled? }
  validates :subscription_tier, inclusion: { in: SUBSCRIPTION_TIERS }
  validate :notification_preferences_shape

  # Local-only accounts (see #local_account?) never collect a real email, but
  # Devise's :validatable/:recoverable and the DB's unique index on email
  # still need *some* unique, well-formed value — so accounts left blank on
  # an opted-in deployment get a generated placeholder under the
  # IANA-reserved "invalid" TLD (RFC 2606), which can never collide with or
  # resolve to a real address. Untouched when LOCAL_ACCOUNTS_ENABLED isn't
  # set, so the default (and any account that supplies a real email) is
  # unaffected.
  LOCAL_ACCOUNT_EMAIL_DOMAIN = "local.invalid"

  before_validation :assign_local_placeholder_email,
                     if: -> { User.local_accounts_enabled? && email.blank? }

  # LOCAL_ACCOUNTS_ENABLED opts a deployment into name+password login with
  # no email required — set it on a self-hosted instance's own env file
  # (e.g. this LXC's /opt/catcare/.env), never on the shared Render cloud
  # deployment, where a real email stays required. Same env-controlled,
  # no-DB-flag pattern as SUPER_ADMIN_EMAIL below.
  def self.local_accounts_enabled?
    ActiveModel::Type::Boolean.new.cast(ENV["LOCAL_ACCOUNTS_ENABLED"]) || false
  end

  # SUPER_ADMIN_EMAIL supports a comma-separated list (still a single email
  # works unchanged) — env-controlled, no DB flag.
  def self.super_admin_emails
    ENV["SUPER_ADMIN_EMAIL"].to_s.split(",").map { |e| e.strip.downcase }.reject(&:empty?)
  end

  def self.super_admin_email?(email)
    email.present? && super_admin_emails.include?(email.to_s.strip.downcase)
  end

  def oauth_user?
    provider.present?
  end

  # Skip Devise's password requirement for OAuth accounts — they have no password.
  def password_required?
    oauth_user? ? false : super
  end

  # True for the local-dev, name+password accounts described above — the
  # email on the record is an internal placeholder, never something the
  # person entered, so it must never be surfaced back to the client.
  def local_account?
    email.to_s.end_with?("@#{LOCAL_ACCOUNT_EMAIL_DOMAIN}")
  end

  # The email to hand back in API responses — nil for local accounts so the
  # frontend never displays or treats the placeholder as a real address.
  def public_email
    local_account? ? nil : email
  end

  # Deletes this user and everything only they could see, while preserving
  # shared household data other members still rely on. Shared by the
  # self-service GDPR flow (Api::V1::AccountController) and admin-initiated
  # deletion (Api::V1::Admin::UsersController) — same rules either way, just
  # a different caller and no password check for the admin path (authority
  # comes from super_admin? there instead).
  #
  # Strategy:
  #   1. For each household where this user is the only active member:
  #      destroy the whole household (cascades cats, events, etc.)
  #   2. For surviving households: promote another admin if needed, then
  #      anonymise every record attributed to this user (NULL the reference
  #      rather than deleting household data other members rely on).
  #   3. Destroy the user — Rails cascades household_memberships and
  #      reminder_recipients via dependent: :destroy.
  def erase!
    ActiveRecord::Base.transaction do
      household_memberships.active.includes(:household).each do |membership|
        household = membership.household
        other_active = household.household_memberships.active.where.not(user_id: id)

        if other_active.empty?
          household.destroy!
        else
          if membership.admin? && other_active.where(role: :admin).empty?
            next_admin = other_active.where.not(role: :sitter).first || other_active.first
            next_admin.update!(role: :admin)
          end
          anonymise_in_household(household.id)
        end
      end

      destroy!
    end
  end

  private

  def anonymise_in_household(household_id)
    CareEvent.where(household_id: household_id, logged_by_id: id).update_all(logged_by_id: nil)
    CareNote.where(household_id: household_id, created_by_id: id).update_all(created_by_id: nil)
    Cat.where(household_id: household_id, created_by_id: id).update_all(created_by_id: nil)
    HouseholdChore.where(household_id: household_id, logged_by_id: id).update_all(logged_by_id: nil)
    PetExpense.where(household_id: household_id, created_by_id: id).update_all(created_by_id: nil)
    VacationTrip.where(household_id: household_id, created_by_id: id).update_all(created_by_id: nil)
  end

  def assign_local_placeholder_email
    loop do
      candidate = "local-#{SecureRandom.hex(8)}@#{LOCAL_ACCOUNT_EMAIL_DOMAIN}"
      unless User.exists?(email: candidate)
        self.email = candidate
        break
      end
    end
  end

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
