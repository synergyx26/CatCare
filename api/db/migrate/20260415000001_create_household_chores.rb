class CreateHouseholdChores < ActiveRecord::Migration[8.0]
  def change
    create_table :household_chores do |t|
      t.references :household, null: false, foreign_key: true
      t.integer    :logged_by_id, null: false
      t.integer    :chore_type, null: false, default: 0
      t.datetime   :occurred_at, null: false
      t.text       :notes

      t.timestamps
    end

    add_index :household_chores, [:household_id, :occurred_at]
    add_index :household_chores, :chore_type
  end
end
