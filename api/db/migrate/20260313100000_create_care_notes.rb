class CreateCareNotes < ActiveRecord::Migration[8.1]
  def change
    create_table :care_notes do |t|
      t.references :household, null: false, foreign_key: true
      t.references :cat,       null: true,  foreign_key: true  # nil = household-level note
      t.integer    :created_by_id, null: false
      t.integer    :category,  null: false, default: 0         # enum: feeding litter supplies home medical general
      t.string     :title,     null: false
      t.text       :body,      null: false
      t.integer    :position,  null: false, default: 0         # ordering within category; ties broken by created_at desc

      t.timestamps
    end

    add_index :care_notes, [:household_id, :cat_id, :category]
    add_index :care_notes, [:household_id, :cat_id, :position]
  end
end
