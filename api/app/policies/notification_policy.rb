class NotificationPolicy < ApplicationPolicy
  def index?    = user.present?
  def update?   = record.user_id == user.id
  def destroy?  = record.user_id == user.id
  def read_all? = user.present?

  class Scope < ApplicationPolicy::Scope
    def resolve = scope.where(user_id: user.id)
  end
end
