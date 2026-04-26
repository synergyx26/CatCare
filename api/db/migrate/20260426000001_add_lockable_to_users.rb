class AddLockableToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :failed_attempts, :integer, default: 0, null: false
    add_column :users, :locked_at, :datetime
    # unlock_token is only consumed by the :email unlock strategy.
    # Included now to avoid a follow-up migration if the strategy is ever
    # changed from :time to :email or :both.
    add_column :users, :unlock_token, :string
    add_index  :users, :unlock_token, unique: true
  end
end
