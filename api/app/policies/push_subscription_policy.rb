class PushSubscriptionPolicy < ApplicationPolicy
  def create?  = user.present?
  def destroy? = record.user_id == user.id
  def test?    = user.present?

  class Scope < ApplicationPolicy::Scope
    def resolve = scope.where(user_id: user.id)
  end
end
