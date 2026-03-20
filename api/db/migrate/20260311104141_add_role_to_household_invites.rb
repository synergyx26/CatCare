class AddRoleToHouseholdInvites < ActiveRecord::Migration[8.1]
  def change
    add_column :household_invites, :role, :integer, default: 0, null: false
  end
end
