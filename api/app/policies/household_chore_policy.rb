class HouseholdChorePolicy < ApplicationPolicy
  # Any active member can view and create chores (sitters can log chores)
  def index?  = active_member?
  def create? = active_member?

  # Sitters can only edit/delete their own chore entries; admins and members can edit any
  def update?  = owner_or_non_sitter?
  def destroy? = owner_or_non_sitter?

  private

  def chore_household
    record.is_a?(Household) ? record : record.household
  end

  def membership
    @membership ||= chore_household.household_memberships.find_by(user: user, status: 1)
  end

  def active_member?
    chore_household.household_memberships.exists?(user: user, status: 1)
  end

  def owner_or_non_sitter?
    return false unless membership
    membership.role != "sitter" || record.logged_by_id == user.id
  end
end
