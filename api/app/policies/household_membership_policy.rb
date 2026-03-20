class HouseholdMembershipPolicy < ApplicationPolicy
  # A user can view and update only their own membership record.
  def show?   = own_membership?
  def update? = own_membership?

  # Admins can change another member's role or remove them.
  def manage_update?  = household_admin? && !own_membership?
  def manage_destroy? = household_admin? && !own_membership?

  private

  def own_membership?
    record.user_id == user.id
  end

  def household_admin?
    HouseholdMembership.exists?(
      user: user, household: record.household, role: :admin, status: :active
    )
  end
end
