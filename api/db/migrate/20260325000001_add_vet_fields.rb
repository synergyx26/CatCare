class AddVetFields < ActiveRecord::Migration[8.1]
  def change
    add_column :cats, :vet_address, :string

    add_column :households, :vet_name,    :string
    add_column :households, :vet_clinic,  :string
    add_column :households, :vet_phone,   :string
    add_column :households, :vet_address, :string
  end
end
