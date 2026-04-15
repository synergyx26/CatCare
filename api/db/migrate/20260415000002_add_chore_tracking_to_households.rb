class AddChoreTrackingToHouseholds < ActiveRecord::Migration[8.0]
  def change
    add_column :households, :track_water,  :boolean, default: true, null: false
    add_column :households, :track_litter, :boolean, default: true, null: false
  end
end
