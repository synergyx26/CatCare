class AddCareRequirementsToCats < ActiveRecord::Migration[8.1]
  def change
    add_column :cats, :feedings_per_day, :integer, default: 1, null: false
    add_column :cats, :track_water, :boolean, default: true, null: false
    add_column :cats, :track_litter, :boolean, default: true, null: false
  end
end
