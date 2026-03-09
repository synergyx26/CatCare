class CreateReminders < ActiveRecord::Migration[8.1]
  def change
    create_table :reminders do |t|
      t.references :cat, null: false, foreign_key: true
      t.references :household, null: false, foreign_key: true
      t.integer :created_by_id, null: false
      t.integer :care_type, null: false, default: 0
      t.string :title
      t.integer :schedule_type, null: false, default: 0  # 0=daily, 1=interval, 2=weekly
      t.string :schedule_value                           # e.g. "07:00", "48", "monday"
      t.boolean :notify_all_members, null: false, default: true
      t.boolean :active, null: false, default: true
      t.datetime :last_triggered_at
      t.datetime :next_trigger_at                        # indexed — Sidekiq polls this

      t.timestamps
    end

    # Sidekiq's ProcessPendingRemindersJob queries: WHERE next_trigger_at <= NOW() AND active = true
    add_index :reminders, :next_trigger_at
    add_index :reminders, [:active, :next_trigger_at]
  end
end
