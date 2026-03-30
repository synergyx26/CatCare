class ReminderPolicy < ApplicationPolicy
  # Any active household member (including sitters) can view reminders
  def index? = active_member?

  # Only non-sitter members can create reminders
  def create? = non_sitter_member?

  # Same rules as destroy: sitters can only edit their own
  def update? = creator_or_non_sitter?

  # show? is used by test_send authorization (membership check only)
  def show? = active_member?

  # Sitters can only delete their own reminders; admins and members can delete any
  def destroy? = creator_or_non_sitter?

  private

  # `record` is a Household (index/create path) or a Reminder (destroy path)
  def reminder_household
    record.is_a?(Household) ? record : record.household
  end

  def membership
    @membership ||= reminder_household.household_memberships.find_by(user: user, status: :active)
  end

  def active_member?
    !!membership
  end

  def non_sitter_member?
    !!membership && membership.role != "sitter"
  end

  def creator_or_non_sitter?
    return false unless membership
    membership.role != "sitter" || record.created_by_id == user.id
  end
end
