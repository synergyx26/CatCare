class CreateHouseholds < ActiveRecord::Migration[8.1]
  def change
    create_table :households do |t|
      t.string :name
      t.integer :created_by

      t.timestamps
    end
  end
end
