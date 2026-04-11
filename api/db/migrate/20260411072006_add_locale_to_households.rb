class AddLocaleToHouseholds < ActiveRecord::Migration[8.1]
  def change
    add_column :households, :currency, :string, null: false, default: 'USD'
    add_column :households, :default_country, :string, null: false, default: 'US'
  end
end
