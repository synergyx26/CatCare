class HouseholdInvite < ApplicationRecord
  belongs_to :household
  belongs_to :invited_by, class_name: "User", foreign_key: :invited_by_id

  enum :status, { pending: 0, accepted: 1, expired: 2 }
  enum :role,   { member: 0, admin: 1, sitter: 2 }

  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :token, presence: true, uniqueness: true

  before_create :generate_token
  before_create :set_expiry

  def usable?
    pending? && expires_at > Time.current
  end

  private

  def generate_token
    self.token = SecureRandom.urlsafe_base64(32)
  end

  def set_expiry
    self.expires_at ||= 7.days.from_now
  end
end
