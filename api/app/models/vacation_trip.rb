class VacationTrip < ApplicationRecord
  belongs_to :household
  belongs_to :creator, class_name: "User", foreign_key: :created_by_id

  validates :start_date, presence: true
  validates :sitter_visit_frequency_days,
    presence: true,
    numericality: { only_integer: true, greater_than_or_equal_to: 1, less_than_or_equal_to: 30 }
  validate :end_date_not_before_start_date

  scope :active_on, ->(date = Date.today) {
    where("start_date <= ?", date)
      .where("end_date IS NULL OR end_date >= ?", date)
  }

  def active?
    active_on_date?(Date.today)
  end

  private

  def active_on_date?(date)
    return false if start_date > date
    end_date.nil? || end_date >= date
  end

  def end_date_not_before_start_date
    return unless start_date.present? && end_date.present?
    errors.add(:end_date, "must be on or after start date") if end_date < start_date
  end
end
