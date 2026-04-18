class AddLocationToHouseholdChoreDefinitions < ActiveRecord::Migration[8.1]
  def change
    add_column :household_chore_definitions, :location, :string
  end
end
