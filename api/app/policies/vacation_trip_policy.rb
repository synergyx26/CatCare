class VacationTripPolicy < ApplicationPolicy
  # Any active household member (including sitters) can view trips
  def index?  = active_member?
  def show?   = active_member?

  # Only admins can create/modify/delete trips
  def create?  = admin_member?
  def update?  = admin_member?
  def destroy? = admin_member?

  private

  # `record` is a Household (index path) or a VacationTrip (create/update/destroy)
  def trip_household
    record.is_a?(Household) ? record : record.household
  end

  def membership
    @membership ||= trip_household.household_memberships.find_by(user: user, status: :active)
  end

  def active_member? = !!membership
  def admin_member?  = !!membership && membership.role == "admin"
end
