class CreateHouseholdInvites < ActiveRecord::Migration[8.1]
  def change
    create_table :household_invites do |t|
      t.references :household, null: false, foreign_key: true
      t.integer :invited_by_id, null: false
      t.string :email, null: false
      t.string :token, null: false
      t.integer :status, null: false, default: 0   # 0=pending, 1=accepted, 2=expired
      t.datetime :expires_at, null: false

      t.timestamps
    end

    # Token must be unique — used in invite URL links
    add_index :household_invites, :token, unique: true
    add_index :household_invites, :email
  end
end
