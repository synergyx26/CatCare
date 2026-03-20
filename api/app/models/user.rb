class User < ApplicationRecord
  include Devise::JWT::RevocationStrategies::JTIMatcher

  devise :database_authenticatable, :registerable,
         :recoverable, :validatable,
         :jwt_authenticatable, jwt_revocation_strategy: self

  has_many :household_memberships, dependent: :destroy
  has_many :households, through: :household_memberships
  has_many :reminder_recipients, dependent: :destroy

  validates :name, presence: true
end
