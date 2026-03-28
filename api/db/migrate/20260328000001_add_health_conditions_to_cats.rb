class AddHealthConditionsToCats < ActiveRecord::Migration[8.1]
  def change
    add_column :cats, :health_conditions, :jsonb, default: [], null: false
    add_index  :cats, :health_conditions, using: :gin
  end
end
