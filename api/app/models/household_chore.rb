class HouseholdChore < ApplicationRecord
  belongs_to :household
  belongs_to :logged_by, class_name: "User", foreign_key: :logged_by_id
  belongs_to :chore_definition, class_name: "HouseholdChoreDefinition", foreign_key: :chore_definition_id

  validates :chore_definition_id, :occurred_at, presence: true

  before_validation :set_occurred_at

  private

  def set_occurred_at
    self.occurred_at ||= Time.current
  end
end
