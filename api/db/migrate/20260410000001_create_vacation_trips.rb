class CreateVacationTrips < ActiveRecord::Migration[8.1]
  def change
    create_table :vacation_trips do |t|
      t.references :household,     null: false, foreign_key: true
      t.bigint     :created_by_id, null: false
      t.date       :start_date,    null: false
      t.date       :end_date
      t.text       :notes
      t.integer    :sitter_visit_frequency_days, null: false, default: 2

      t.timestamps
    end

    add_foreign_key :vacation_trips, :users, column: :created_by_id
    add_index :vacation_trips, [:household_id, :start_date]
  end
end
