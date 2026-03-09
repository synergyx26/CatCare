class CreateReminderRecipients < ActiveRecord::Migration[8.1]
  def change
    create_table :reminder_recipients do |t|
      t.references :reminder, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true

      t.timestamps
    end
  end
end
