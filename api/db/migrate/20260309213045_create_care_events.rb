class CreateCareEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :care_events do |t|
      t.references :cat, null: false, foreign_key: true
      t.references :household, null: false, foreign_key: true
      t.integer :logged_by_id, null: false
      t.integer :event_type, null: false, default: 0  # feeding, litter, water, weight, note, etc.
      t.datetime :occurred_at, null: false             # user-adjustable; defaults to created_at in model
      t.text :notes
      t.jsonb :details, default: {}                    # event-type-specific payload (food, weight, etc.)

      t.timestamps
    end

    # Core query: "all care events for this household today"
    add_index :care_events, :household_id
    add_index :care_events, :cat_id
    add_index :care_events, :occurred_at
    add_index :care_events, :event_type
    # JSONB index for querying inside details
    add_index :care_events, :details, using: :gin
  end
end
