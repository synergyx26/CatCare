class AddProfileFieldsToHouseholdMemberships < ActiveRecord::Migration[8.1]
  def change
    add_column :household_memberships, :phone,                    :string
    add_column :household_memberships, :emergency_contact_name,   :string
    add_column :household_memberships, :emergency_contact_phone,  :string
    add_column :household_memberships, :notes,                    :text
  end
end
