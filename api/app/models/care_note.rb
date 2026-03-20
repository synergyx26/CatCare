class CareNote < ApplicationRecord
  belongs_to :household
  belongs_to :cat, optional: true
  belongs_to :creator, class_name: "User", foreign_key: :created_by_id

  enum :category, { feeding: 0, litter: 1, supplies: 2, home: 3, medical: 4, general: 5 }

  validates :title,    presence: true, length: { maximum: 120 }
  validates :body,     presence: true
  validates :category, presence: true
  validate  :cat_belongs_to_household

  scope :household_level, -> { where(cat_id: nil) }
  scope :for_cat,         ->(cat) { where(cat: cat) }
  scope :ordered,         -> { order(position: :asc, created_at: :desc) }

  private

  def cat_belongs_to_household
    return unless cat_id.present?
    errors.add(:cat, "does not belong to this household") unless household.cats.exists?(id: cat_id)
  end
end
