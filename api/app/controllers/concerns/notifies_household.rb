# One line in a create action tells the rest of the household about the new
# record (see NotifyHouseholdActivityJob). Call it only after a successful save.
module NotifiesHousehold
  extend ActiveSupport::Concern

  private

  def notify_household_of(record)
    NotifyHouseholdActivityJob.perform_later(record, current_user.id)
  end
end
