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

  # Computes when this reminder should next fire.
  #
  # after_fire: false  — used on create; finds the next future occurrence
  # after_fire: true   — used after firing; advances from last_triggered_at
  def calculate_next_trigger_at(after_fire: false)
    case schedule_type
    when "daily"
      h, m = schedule_value.split(":").map(&:to_i)
      if after_fire
        (last_triggered_at || Time.current) + 24.hours
      else
        candidate = Time.current.utc.change(hour: h, min: m, sec: 0)
        candidate <= Time.current ? candidate + 1.day : candidate
      end

    when "interval"
      n    = schedule_value.to_i
      base = after_fire ? (last_triggered_at || Time.current) : Time.current
      base + n.hours

    when "weekly"
      parts       = schedule_value.split(":")
      target_wday = Date::DAYNAMES.map(&:downcase).index(parts[0].downcase)
      fire_h      = parts[1]&.to_i || 0
      fire_m      = parts[2]&.to_i || 0
      if after_fire
        (last_triggered_at || Time.current) + 7.days
      else
        candidate  = Time.current.utc.change(hour: fire_h, min: fire_m, sec: 0)
        days_ahead = (target_wday - Time.current.utc.wday) % 7
        candidate += days_ahead.days
        candidate <= Time.current ? candidate + 7.days : candidate
      end
    end
  end
end
