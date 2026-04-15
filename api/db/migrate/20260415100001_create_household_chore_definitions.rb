class CreateHouseholdChoreDefinitions < ActiveRecord::Migration[8.1]
  def change
    create_table :household_chore_definitions do |t|
      t.references :household, null: false, foreign_key: true
      t.string  :name,     null: false
      t.string  :emoji
      t.boolean :active,   null: false, default: true
      t.integer :position, null: false, default: 0
      t.timestamps
    end

    add_index :household_chore_definitions, [:household_id, :position]
  end
end
