class HouseholdInvitePolicy < ApplicationPolicy
  # record is always the Household (collection-level authorization)

  # Members and admins can view invite list; sitters cannot
  def index?  = non_sitter_member?

  # Only admins can create or revoke invites
  def create?  = admin?
  def destroy? = admin?

  private

  def non_sitter_member?
    record.household_memberships.where(user: user, status: 1).where.not(role: 2).exists?
  end

  def admin?
    record.household_memberships.exists?(user: user, role: 1, status: 1)
  end
end
