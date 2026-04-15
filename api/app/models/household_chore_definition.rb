class HouseholdChoreDefinition < ApplicationRecord
  belongs_to :household
  has_many :household_chores, foreign_key: :chore_definition_id, dependent: :destroy

  validates :name, presence: true
  validates :position,         numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :frequency_per_day, numericality: { only_integer: true, greater_than_or_equal_to: 1 }

  scope :active,   -> { where(active: true) }
  scope :ordered,  -> { order(:position, :id) }
end
