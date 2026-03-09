class CreateHouseholdMemberships < ActiveRecord::Migration[8.1]
  def change
    create_table :household_memberships do |t|
      t.references :household, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.integer :role, null: false, default: 0       # 0=member, 1=admin
      t.integer :status, null: false, default: 0     # 0=pending, 1=active, 2=removed
      t.datetime :joined_at
      t.integer :invited_by_id

      t.timestamps
    end

    # A user can only belong to a household once
    add_index :household_memberships, [:household_id, :user_id], unique: true
  end
end
