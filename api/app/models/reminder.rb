class Reminder < ApplicationRecord
  belongs_to :cat
  belongs_to :household
  belongs_to :created_by, class_name: 'User', foreign_key: :created_by_id

  has_many :reminder_recipients, dependent: :destroy

  enum :care_type, {
    feeding: 0, litter: 1, water: 2, weight: 3,
    note: 4, medication: 5, vet_visit: 6, grooming: 7
  }

  enum :schedule_type, { daily: 0, interval: 1, weekly: 2 }

  validates :care_type, presence: true
  validates :schedule_type, presence: true
end
