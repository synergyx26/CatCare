class AddSitterFieldsToCatsAndHouseholds < ActiveRecord::Migration[8.1]
  def change
    add_column :cats, :vet_name,           :string
    add_column :cats, :vet_clinic,         :string
    add_column :cats, :vet_phone,          :string
    add_column :cats, :care_instructions,  :text

    add_column :households, :emergency_contact_name,  :string
    add_column :households, :emergency_contact_phone, :string
  end
end
