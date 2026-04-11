class CreatePetExpenses < ActiveRecord::Migration[8.1]
  def change
    create_table :pet_expenses do |t|
      t.references :household,   null: false, foreign_key: true
      t.bigint     :cat_id                          # nullable — null means household-level
      t.bigint     :created_by_id, null: false

      t.string     :product_name, null: false
      t.string     :brand
      t.integer    :category,     null: false, default: 0

      t.decimal    :unit_price,   null: false, precision: 10, scale: 2
      t.decimal    :quantity,     null: false, precision: 8,  scale: 3, default: "1.0"
      t.string     :unit_label                      # "bag", "can", "lbs", etc.

      t.date       :purchase_date, null: false

      t.string     :store_name
      t.string     :store_url

      t.boolean    :is_recurring,             null: false, default: false
      t.integer    :recurrence_interval_days  # only used when is_recurring=true

      t.text       :notes

      t.timestamps
    end

    add_foreign_key :pet_expenses, :cats
    add_foreign_key :pet_expenses, :users, column: :created_by_id

    add_index :pet_expenses, [ :household_id, :purchase_date ]
    add_index :pet_expenses, [ :household_id, :category ]
    add_index :pet_expenses, [ :household_id, :cat_id ]
    add_index :pet_expenses, [ :household_id, :is_recurring ]
  end
end
