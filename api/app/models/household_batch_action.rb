class HouseholdBatchAction < ApplicationRecord
  belongs_to :household

  VALID_EVENT_TYPES = %w[
    feeding litter water weight note medication vet_visit grooming symptom tooth_brushing
  ].freeze

  validates :label,      presence: true
  validates :event_type, presence: true, inclusion: { in: VALID_EVENT_TYPES }

  default_scope { order(:position, :id) }
end
