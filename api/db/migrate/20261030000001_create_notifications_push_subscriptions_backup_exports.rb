class CreateNotificationsPushSubscriptionsBackupExports < ActiveRecord::Migration[8.1]
  def change
    # Per-user inbox. `kind` is a free-form dotted key ("backup.ready") so new
    # features can add their own without a migration; `data` carries any
    # kind-specific payload.
    create_table :notifications do |t|
      t.references :user, null: false, foreign_key: true
      t.string   :kind,  null: false
      t.string   :title, null: false
      t.text     :body
      t.string   :url
      t.jsonb    :data, null: false, default: {}
      t.datetime :read_at
      t.timestamps
    end
    add_index :notifications, [:user_id, :read_at]
    add_index :notifications, [:user_id, :created_at]

    # One row per browser/device that opted in to Web Push.
    create_table :push_subscriptions do |t|
      t.references :user, null: false, foreign_key: true
      t.text   :endpoint, null: false
      t.string :p256dh,   null: false
      t.string :auth,     null: false
      t.string :user_agent
      t.datetime :last_used_at
      t.timestamps
    end
    add_index :push_subscriptions, :endpoint, unique: true

    # Database exports kept inside the app (file lives in Active Storage).
    create_table :backup_exports do |t|
      t.string  :kind,   null: false, default: "csv"
      t.string  :status, null: false, default: "pending"
      t.bigint  :byte_size
      t.string  :checksum_sha256
      t.jsonb   :table_counts, null: false, default: {}
      t.text    :error
      t.references :requested_by, foreign_key: { to_table: :users }
      t.timestamps
    end
    add_index :backup_exports, :created_at
  end
end
