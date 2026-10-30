module Notifications
  # The one entry point every feature uses to tell a user something:
  #
  #   Notifications::Notifier.call(user, kind: "backup.ready", title: "...",
  #                                body: "...", url: "/admin/backups")
  #
  # Always writes to the in-app inbox; additionally fans out Web Push to the
  # user's registered devices when they've enabled push (and, if `category`
  # is given, that category in their preferences).
  #
  # Bursts: pass `coalesce: { key:, within: }` to fold repeats into one inbox
  # row. If the user has an unread notification of the same `kind` and key
  # newer than `within`, the block receives it and returns the attributes to
  # update it with (title/body/url/data); otherwise a new row is created.
  # Push is still sent for each call, and devices replace the previous banner
  # (same `kind` tag), so a burst reads as one evolving notification.
  class Notifier
    def self.call(user, kind:, title:, body: nil, url: nil, data: {}, category: nil, coalesce: nil)
      existing = coalesce && find_coalescable(user, kind, coalesce)

      notification =
        if existing
          attrs = block_given? ? yield(existing) : { title: title, body: body, url: url, data: data }
          merged = (attrs[:data] || existing.data).merge("coalesce_key" => coalesce[:key])
          existing.update!(attrs.merge(data: merged))
          existing
        else
          data = data.merge("coalesce_key" => coalesce[:key]) if coalesce
          user.notifications.create!(kind: kind, title: title, body: body, url: url, data: data)
        end

      DeliverPushNotificationJob.perform_later(notification.id) if push_wanted?(user, category)
      notification
    end

    def self.push_wanted?(user, category)
      prefs = (user.notification_preferences || {})["push"] || {}
      return false unless prefs["enabled"]
      return false unless user.push_subscriptions.exists?
      category.nil? || prefs[category.to_s] != false
    end

    def self.find_coalescable(user, kind, coalesce)
      user.notifications.unread
          .where(kind: kind)
          .where("created_at > ?", coalesce[:within].ago)
          .where("data ->> 'coalesce_key' = ?", coalesce[:key])
          .order(:created_at).last
    end
    private_class_method :find_coalescable
  end
end
