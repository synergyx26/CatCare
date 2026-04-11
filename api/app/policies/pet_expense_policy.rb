class PetExpensePolicy < ApplicationPolicy
  def index?  = active_member?
  def stats?  = active_member?
  def create?  = admin_or_member?
  def update?  = admin_or_member?
  def destroy? = admin_or_member?

  private

  def expense_household
    record.is_a?(Household) ? record : record.household
  end

  def membership
    @membership ||= expense_household.household_memberships.find_by(user: user, status: 1)
  end

  def active_member?  = !!membership

  def admin_or_member?
    return false unless membership
    %w[admin member].include?(membership.role)
  end
end
