class CreateCats < ActiveRecord::Migration[8.1]
  def change
    create_table :cats do |t|
      t.references :household, null: false, foreign_key: true
      t.integer :created_by_id, null: false
      t.string :name, null: false
      t.integer :species, null: false, default: 0   # 0=cat, 1=dog, etc. (future expansion)
      t.integer :sex, default: 0                    # 0=unknown, 1=male, 2=female
      t.boolean :sterilized, default: false
      t.date :birthday
      t.string :breed
      t.string :microchip_number
      t.text :health_notes
      t.boolean :active, null: false, default: true  # false = archived/deceased

      t.timestamps
    end

    # :household_id index already created by t.references above
    add_index :cats, :active
  end
end
