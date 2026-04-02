class HouseholdBatchActionPolicy < ApplicationPolicy
  # Any active household member can view batch actions
  def index?  = active_member?

  # Sitters cannot create, modify, or delete batch action configs
  def create?  = non_sitter_member?
  def update?  = non_sitter_member?
  def destroy? = non_sitter_member?

  private

  def household
    record.is_a?(HouseholdBatchAction) ? record.household : record
  end

  def active_member?
    household.household_memberships.exists?(user: user, status: 1)
  end

  def non_sitter_member?
    household.household_memberships.where(user: user, status: 1).where.not(role: 2).exists?
  end
end
