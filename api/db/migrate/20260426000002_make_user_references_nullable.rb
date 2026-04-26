class MakeUserReferencesNullable < ActiveRecord::Migration[8.1]
  # Required for GDPR right-to-erasure: when a user account is deleted, their
  # identity is anonymised from shared household records rather than cascading
  # a delete that would destroy other members' data.
  #
  # Tables affected and why they are NOT NULL today:
  #   care_events.logged_by_id       — who logged the care event
  #   care_notes.created_by_id       — who wrote the note
  #   cats.created_by_id             — who added the cat profile
  #   household_chores.logged_by_id  — who completed the chore
  #   pet_expenses.created_by_id     — who recorded the expense (FK to users)
  #   vacation_trips.created_by_id   — who created the trip (FK to users)
  #
  # Making these nullable is safe: existing rows are valid (all have a value).
  # NULL after account deletion means "original author no longer exists" — a
  # common and well-understood pattern for anonymised audit trails.
  def change
    change_column_null :care_events,      :logged_by_id,  true
    change_column_null :care_notes,       :created_by_id, true
    change_column_null :cats,             :created_by_id, true
    change_column_null :household_chores, :logged_by_id,  true
    change_column_null :pet_expenses,     :created_by_id, true
    change_column_null :vacation_trips,   :created_by_id, true
  end
end
