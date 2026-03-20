class Cat < ApplicationRecord
  belongs_to :household
  belongs_to :creator, class_name: "User", foreign_key: :created_by_id

  has_many :care_events, dependent: :destroy
  has_many :reminders, dependent: :destroy
  has_many :care_notes, dependent: :destroy

  has_one_attached :photo

  enum :species, { cat: 0, dog: 1, rabbit: 2, bird: 3, fish: 4, other: 5 }
  enum :sex,     { unknown: 0, male: 1, female: 2 }

  validates :name, presence: true
  validates :species, presence: true

  scope :active,   -> { where(active: true) }
  scope :archived, -> { where(active: false, deceased: false) }
  scope :deceased, -> { where(active: false, deceased: true) }
end
