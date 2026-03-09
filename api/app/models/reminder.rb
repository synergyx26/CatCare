class Reminder < ApplicationRecord
  belongs_to :cat
  belongs_to :household
end
