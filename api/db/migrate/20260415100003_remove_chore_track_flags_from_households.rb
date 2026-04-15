class RemoveChoreTrackFlagsFromHouseholds < ActiveRecord::Migration[8.1]
  def up
    remove_column :households, :track_water
    remove_column :households, :track_litter
  end

  def down
    add_column :households, :track_water,  :boolean, default: true, null: false
    add_column :households, :track_litter, :boolean, default: true, null: false
  end
end
