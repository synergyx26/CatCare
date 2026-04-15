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
  has_many :pet_expenses, dependent: :destroy
  has_many :household_chores,            dependent: :destroy
  has_many :household_chore_definitions, dependent: :destroy

  validates :name, presence: true

  after_create :create_default_chore_definitions

  def active_vacation_trip
    vacation_trips.where(active: true).active_on(Date.today).order(start_date: :desc).first
  end

  private

  def create_default_chore_definitions
    household_chore_definitions.create!([
      { name: "Litter boxes",   emoji: "🧹", active: true, position: 0 },
      { name: "Water fountain", emoji: "💧", active: true, position: 1 },
    ])
  end
end
