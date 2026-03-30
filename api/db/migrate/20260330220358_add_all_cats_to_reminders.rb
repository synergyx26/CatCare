class AddAllCatsToReminders < ActiveRecord::Migration[8.1]
  def change
    change_column_null :reminders, :cat_id, true
    add_column :reminders, :all_cats, :boolean, default: false, null: false
  end
end
