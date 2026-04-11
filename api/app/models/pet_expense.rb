class PetExpense < ApplicationRecord
  belongs_to :household
  belongs_to :cat, optional: true
  belongs_to :created_by, class_name: "User", foreign_key: :created_by_id

  enum :category, {
    food: 0, treats: 1, litter: 2, toys: 3,
    medication: 4, grooming: 5, accessories: 6, other: 7
  }

  validates :product_name,  presence: true, length: { maximum: 200 }
  validates :brand,         length: { maximum: 100 }, allow_blank: true
  validates :category,      presence: true
  validates :unit_price,    presence: true,
                            numericality: { greater_than: 0, less_than_or_equal_to: 99_999.99 }
  validates :quantity,      presence: true, numericality: { greater_than: 0 }
  validates :purchase_date, presence: true
  validates :store_url,     format: { with: URI::DEFAULT_PARSER.make_regexp(%w[http https]),
                                      message: "must be a valid URL" },
                            allow_blank: true
  validates :recurrence_interval_days,
            numericality: { only_integer: true, greater_than_or_equal_to: 1 },
            allow_nil: true
  validate  :recurrence_interval_required_when_recurring

  scope :for_range, ->(start_date, end_date) {
    result = all
    result = result.where("purchase_date >= ?", start_date) if start_date.present?
    result = result.where("purchase_date <= ?", end_date)   if end_date.present?
    result
  }
  scope :for_category, ->(cat)    { cat.present? ? where(category: cat) : all }
  scope :for_cat,      ->(cat_id) { cat_id.present? ? where(cat_id: cat_id) : all }
  scope :recurring,    ->         { where(is_recurring: true) }
  scope :due_within,   ->(days) {
    recurring.where(
      "purchase_date + recurrence_interval_days * INTERVAL '1 day' BETWEEN ? AND ?",
      Date.today, Date.today + days
    )
  }

  def total_cost
    unit_price * quantity
  end

  private

  def recurrence_interval_required_when_recurring
    if is_recurring && recurrence_interval_days.blank?
      errors.add(:recurrence_interval_days, "is required for recurring purchases")
    end
  end
end
