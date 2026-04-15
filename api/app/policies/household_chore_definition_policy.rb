class HouseholdChoreDefinitionPolicy < ApplicationPolicy
  # Any active member (including sitters) can view definitions
  def index? = active_member?

  # Only admins and members can manage definitions (not sitters)
  def create?  = non_sitter?
  def update?  = non_sitter?
  def destroy? = non_sitter?

  private

  def definition_household
    record.is_a?(Household) ? record : record.household
  end

  def membership
    @membership ||= definition_household.household_memberships.find_by(user: user, status: 1)
  end

  def active_member?
    definition_household.household_memberships.exists?(user: user, status: 1)
  end

  def non_sitter?
    return false unless membership
    membership.role != "sitter"
  end
end
