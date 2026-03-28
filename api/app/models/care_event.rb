class CareEvent < ApplicationRecord
  belongs_to :cat
  belongs_to :household
  belongs_to :logged_by, class_name: "User", foreign_key: :logged_by_id

  enum :event_type, {
    feeding:    0,
    litter:     1,
    water:      2,
    weight:     3,
    note:       4,
    medication: 5,
    vet_visit:  6,
    grooming:       7,
    symptom:        8,
    tooth_brushing: 9,
  }

  validates :event_type, presence: true
  validates :occurred_at, presence: true

  before_validation :set_occurred_at

  private

  def set_occurred_at
    self.occurred_at ||= Time.current
  end
end
