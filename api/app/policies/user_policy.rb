class UserPolicy < ApplicationPolicy
  # A user may only update their own notification preferences.
  def update_notification_preferences?
    record == user
  end
end
