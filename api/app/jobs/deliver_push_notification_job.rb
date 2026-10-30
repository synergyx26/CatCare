class DeliverPushNotificationJob < ApplicationJob
  queue_as :default
  discard_on ActiveRecord::RecordNotFound

  def perform(notification_id)
    notification = Notification.find(notification_id)
    Notifications::WebPushSender.deliver(
      notification.user,
      id: notification.id, title: notification.title, body: notification.body,
      url: notification.url, kind: notification.kind
    )
  end
end
