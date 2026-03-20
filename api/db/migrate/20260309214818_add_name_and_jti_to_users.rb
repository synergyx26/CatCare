class AddNameAndJtiToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :name, :string, null: false, default: ""
    add_column :users, :jti, :string, null: false, default: ""
    add_index :users, :jti, unique: true
  end
end
