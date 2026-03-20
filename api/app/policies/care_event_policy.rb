class CareEventPolicy < ApplicationPolicy
  # Any active member can view and create care events (sitters can log care)
  def index?  = active_member?
  def create? = active_member?

  # Sitters can only edit/delete their own events; admins and members can edit any
  def update?  = owner_or_non_sitter?
  def destroy? = owner_or_non_sitter?

  private

  # `record` may be a CareEvent (create/update/destroy) or a Household (index).
  def event_household
    record.is_a?(Household) ? record : record.household
  end

  def membership
    @membership ||= event_household.household_memberships.find_by(user: user, status: 1)
  end

  def active_member?
    event_household.household_memberships.exists?(user: user, status: 1)
  end

  def owner_or_non_sitter?
    return false unless membership
    membership.role != "sitter" || record.logged_by_id == user.id
  end
end
