class ReminderRecipient < ApplicationRecord
  belongs_to :reminder
  belongs_to :user
end
