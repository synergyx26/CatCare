class CreateHouseholdBatchActions < ActiveRecord::Migration[8.1]
  def change
    create_table :household_batch_actions do |t|
      t.references :household, null: false, foreign_key: true
      t.string  :label,         null: false
      t.string  :event_type,    null: false
      t.jsonb   :details,       null: false, default: {}
      t.string  :default_notes
      t.integer :position,      null: false, default: 0

      t.timestamps
    end
  end
end
