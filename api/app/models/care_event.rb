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

  # Medication supply countdown fields (all optional, stored in `details`).
  # The start event (active_medication: true) holds the initial count snapshot —
  # supply_quantity on hand at supply_refilled_at. Each new supply (e.g. a new
  # inhaler opened) is its own event with supply_refill: true and
  # supply_quantity counted at occurred_at; the newest snapshot wins. Remaining
  # supply is derived from dose events logged since then. Dose events may carry
  # supply_used to override the regimen's supply_per_dose.
  SUPPLY_MAX = 100_000
  SUPPLY_NON_NEGATIVE_KEYS = %w[supply_quantity supply_low_threshold supply_used].freeze
  SUPPLY_UNIT_MAX_LENGTH = 30

  before_validation :set_occurred_at
  validate :medication_supply_details, if: :medication?

  private

  def set_occurred_at
    self.occurred_at ||= Time.current
  end

  def medication_supply_details
    d = (details || {}).to_h.stringify_keys

    SUPPLY_NON_NEGATIVE_KEYS.each do |key|
      next unless d.key?(key)
      value = numeric_detail(d[key])
      unless value && value >= 0 && value <= SUPPLY_MAX
        errors.add(:details, "#{key} must be a number between 0 and #{SUPPLY_MAX}")
      end
    end

    if d.key?("supply_per_dose")
      value = numeric_detail(d["supply_per_dose"])
      unless value && value > 0 && value <= SUPPLY_MAX
        errors.add(:details, "supply_per_dose must be a number greater than 0 and at most #{SUPPLY_MAX}")
      end
    end

    if d.key?("supply_unit")
      unit = d["supply_unit"]
      unless unit.is_a?(String) && unit.strip.length.between?(1, SUPPLY_UNIT_MAX_LENGTH)
        errors.add(:details, "supply_unit must be 1-#{SUPPLY_UNIT_MAX_LENGTH} characters")
      end
    end

    if d.key?("supply_refilled_at")
      parsed = d["supply_refilled_at"].is_a?(String) && (Time.iso8601(d["supply_refilled_at"]) rescue nil)
      errors.add(:details, "supply_refilled_at must be an ISO 8601 timestamp") unless parsed
    end

    if d.key?("supply_refill") && ![ true, false ].include?(d["supply_refill"])
      errors.add(:details, "supply_refill must be true or false")
    end

    if d["supply_refill"] == true
      # A new-supply entry's count is taken at occurred_at
      errors.add(:details, "supply_quantity is required for a new supply") unless d.key?("supply_quantity")
      errors.add(:details, "a new supply can't also start a medication") if d["active_medication"] == true
    elsif d.key?("supply_quantity") && !d.key?("supply_refilled_at")
      # The countdown is meaningless without the moment the count was taken.
      errors.add(:details, "supply_refilled_at is required when supply_quantity is set")
    end
  end

  def numeric_detail(value)
    case value
    when Numeric then value.to_f
    when String  then Float(value, exception: false)
    end
  end
end
