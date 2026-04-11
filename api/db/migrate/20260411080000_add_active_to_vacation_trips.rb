class AddActiveToVacationTrips < ActiveRecord::Migration[8.1]
  def change
    add_column :vacation_trips, :active, :boolean, default: true, null: false
    add_index :vacation_trips, [:household_id, :active]
  end
end
