class Household < ApplicationRecord
  belongs_to :creator, class_name: "User", foreign_key: :created_by
  has_many :household_memberships, dependent: :destroy
  has_many :members, through: :household_memberships, source: :user
  has_many :household_invites, dependent: :destroy
  has_many :cats, dependent: :destroy
  has_many :care_events, dependent: :destroy
  has_many :reminders, dependent: :destroy
  has_many :care_notes, dependent: :destroy
  has_many :household_batch_actions, dependent: :destroy
  has_many :vacation_trips, dependent: :destroy

  validates :name, presence: true

  def active_vacation_trip
    vacation_trips.active_on(Date.today).order(start_date: :desc).first
  end
end
