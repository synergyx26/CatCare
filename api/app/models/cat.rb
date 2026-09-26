class Cat < ApplicationRecord
  belongs_to :household
  belongs_to :creator, class_name: "User", foreign_key: :created_by_id

  has_many :care_events, dependent: :destroy
  has_many :reminders, dependent: :destroy
  has_many :care_notes, dependent: :destroy

  has_one_attached :photo

  enum :species, { cat: 0, dog: 1, rabbit: 2, bird: 3, fish: 4, other: 5 }
  enum :sex,     { unknown: 0, male: 1, female: 2 }

  # Cartoon look used by the web app's playful UI (see AnimatedCat.tsx).
  # fur is the base coat; fur2/fur3 are pattern colours whose meaning depends
  # on the pattern (stripes, white patches, points…).
  APPEARANCE_PATTERNS = %w[solid tabby tuxedo bicolor calico tortoiseshell colorpoint].freeze
  APPEARANCE_REQUIRED_KEYS = %w[pattern fur eyes].freeze
  APPEARANCE_KEYS = %w[pattern fur fur2 fur3 eyes].freeze
  APPEARANCE_COLOR_KEYS = %w[fur fur2 fur3 eyes].freeze
  HEX_COLOR = /\A#\h{6}\z/

  validates :name, presence: true
  validates :species, presence: true
  validates :feedings_per_day, presence: true,
    numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 10 }
  validate :appearance_shape

  before_validation :normalize_appearance

  scope :active,   -> { where(active: true) }
  scope :archived, -> { where(active: false, deceased: false) }
  scope :deceased, -> { where(active: false, deceased: true) }

  private

  # Stringify keys, drop blank optional colours and lowercase hex values so
  # the stored JSON is canonical regardless of how the client sent it.
  def normalize_appearance
    return unless appearance.is_a?(Hash)

    self.appearance = appearance.to_h.transform_keys(&:to_s).each_with_object({}) do |(key, value), out|
      next if value.blank? && !APPEARANCE_REQUIRED_KEYS.include?(key)
      out[key] = APPEARANCE_COLOR_KEYS.include?(key) && value.is_a?(String) ? value.downcase : value
    end
  end

  def appearance_shape
    return if appearance.nil?

    unless appearance.is_a?(Hash)
      errors.add(:appearance, "must be an object")
      return
    end

    unknown = appearance.keys - APPEARANCE_KEYS
    errors.add(:appearance, "has unknown keys: #{unknown.join(', ')}") if unknown.any?

    missing = APPEARANCE_REQUIRED_KEYS - appearance.keys
    errors.add(:appearance, "is missing #{missing.join(', ')}") if missing.any?

    if appearance.key?("pattern") && !APPEARANCE_PATTERNS.include?(appearance["pattern"])
      errors.add(:appearance, "pattern must be one of #{APPEARANCE_PATTERNS.join(', ')}")
    end

    (APPEARANCE_COLOR_KEYS & appearance.keys).each do |key|
      errors.add(:appearance, "#{key} must be a #rrggbb colour") unless appearance[key].is_a?(String) && appearance[key].match?(HEX_COLOR)
    end
  end
end
