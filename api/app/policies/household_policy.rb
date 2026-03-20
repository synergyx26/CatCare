class HouseholdPolicy < ApplicationPolicy
  # A user can only access a household they are an active member of.
  def show?   = member?
  def update? = admin?

  private

  def member?
    record.household_memberships.exists?(user: user, status: 1)
  end

  def admin?
    record.household_memberships.exists?(user: user, role: 1, status: 1)
  end

  def sitter?
    record.household_memberships.exists?(user: user, role: 2, status: 1)
  end
end
