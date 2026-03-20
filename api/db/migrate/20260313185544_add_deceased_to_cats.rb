class AddDeceasedToCats < ActiveRecord::Migration[8.1]
  def change
    add_column :cats, :deceased, :boolean, default: false, null: false
  end
end
