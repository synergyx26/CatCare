module Notifications
  # The one entry point every feature uses to tell a user something:
  #
  #   Notifications::Notifier.call(user, kind: "backup.ready", title: "...",
  #                                body: "...", url: "/admin/backups")
  #
  # Always writes to the in-app inbox; additionally fans out Web Push to the
  # user's registered devices when they've enabled push (and, if `category`
  # is given, that category in their preferences).
  class Notifier
    def self.call(user, kind:, title:, body: nil, url: nil, data: {}, category: nil)
      notification = user.notifications.create!(kind: kind, title: title, body: body, url: url, data: data)
      DeliverPushNotificationJob.perform_later(notification.id) if push_wanted?(user, category)
      notification
    end

    def self.push_wanted?(user, category)
      prefs = (user.notification_preferences || {})["push"] || {}
      return false unless prefs["enabled"]
      return false unless user.push_subscriptions.exists?
      category.nil? || prefs[category.to_s] != false
    end
  end
end
