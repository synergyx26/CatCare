class HouseholdMembership < ApplicationRecord
  belongs_to :household
  belongs_to :user

  enum :role,   { member: 0, admin: 1, sitter: 2 }
  enum :status, { pending: 0, active: 1, removed: 2 }

  validates :user_id, uniqueness: { scope: :household_id }
end
