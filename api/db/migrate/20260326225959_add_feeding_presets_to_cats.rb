class AddFeedingPresetsToCats < ActiveRecord::Migration[8.1]
  DEFAULTS = {
    "wet"    => [50, 60, 70, 80],
    "dry"    => [80, 90, 100],
    "treats" => [],
    "other"  => []
  }.freeze

  def change
    add_column :cats, :feeding_presets, :jsonb, default: DEFAULTS, null: false
  end
end
