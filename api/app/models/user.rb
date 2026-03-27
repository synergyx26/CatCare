class User < ApplicationRecord
  include Devise::JWT::RevocationStrategies::JTIMatcher

  devise :database_authenticatable, :registerable,
         :recoverable, :validatable,
         :jwt_authenticatable, jwt_revocation_strategy: self

  has_many :household_memberships, dependent: :destroy
  has_many :households, through: :household_memberships
  has_many :reminder_recipients, dependent: :destroy

  SUBSCRIPTION_TIERS = %w[free pro premium].freeze

  validates :name, presence: true
  validates :subscription_tier, inclusion: { in: SUBSCRIPTION_TIERS }

  def oauth_user?
    provider.present?
  end

  # Skip Devise's password requirement for OAuth accounts — they have no password.
  def password_required?
    oauth_user? ? false : super
  end
end
