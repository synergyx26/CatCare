class AddTrackToothbrushingToCats < ActiveRecord::Migration[8.1]
  def change
    add_column :cats, :track_toothbrushing, :boolean, default: false, null: false
  end
end
