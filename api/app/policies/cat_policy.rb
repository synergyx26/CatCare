class CatPolicy < ApplicationPolicy
  # index/show/stats — any active household member (including sitters)
  def index?  = active_member?
  def show?   = active_member?
  def stats?  = active_member?

  # create/update/archive — members and admins only (sitters cannot modify cats)
  def create?  = non_sitter_member?
  def update?  = non_sitter_member?
  def archive? = non_sitter_member?

  private

  # For collection actions the record is the Household; for member actions it's a Cat.
  def household
    record.is_a?(Cat) ? record.household : record
  end

  def active_member?
    household.household_memberships.exists?(user: user, status: 1)
  end

  def non_sitter_member?
    household.household_memberships.where(user: user, status: 1).where.not(role: 2).exists?
  end
end
