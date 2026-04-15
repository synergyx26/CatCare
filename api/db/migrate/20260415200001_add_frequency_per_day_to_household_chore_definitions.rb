class AddFrequencyPerDayToHouseholdChoreDefinitions < ActiveRecord::Migration[8.1]
  def change
    add_column :household_chore_definitions, :frequency_per_day, :integer, null: false, default: 1
  end
end
