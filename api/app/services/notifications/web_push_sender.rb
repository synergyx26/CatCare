module Notifications
  # Thin wrapper over the web-push gem. Never raises into callers: a dead
  # subscription is deleted, anything else is logged and reported.
  class WebPushSender
    class NotConfigured < StandardError; end

    def self.configured?
      ENV["VAPID_PUBLIC_KEY"].present? && ENV["VAPID_PRIVATE_KEY"].present?
    end

    def self.public_key = ENV["VAPID_PUBLIC_KEY"]

    # Returns the number of devices the message was accepted for.
    def self.deliver(user, payload)
      return 0 unless configured?

      user.push_subscriptions.to_a.count { |sub| deliver_to(sub, payload) }
    end

    def self.deliver_to(sub, payload)
      WebPush.payload_send(
        message:  payload.to_json,
        endpoint: sub.endpoint,
        p256dh:   sub.p256dh,
        auth:     sub.auth,
        ttl:      24 * 3600,
        vapid: {
          subject:     ENV.fetch("VAPID_SUBJECT", "mailto:#{ENV['MAILER_SENDER'].presence || 'noreply@catcare.app'}"),
          public_key:  ENV["VAPID_PUBLIC_KEY"],
          private_key: ENV["VAPID_PRIVATE_KEY"]
        }
      )
      sub.update_columns(last_used_at: Time.current)
      true
    rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription, WebPush::Unauthorized
      sub.destroy
      false
    rescue StandardError => e
      Sentry.capture_exception(e, extra: { push_subscription_id: sub.id }) if defined?(Sentry)
      Rails.logger.error("WebPush delivery failed for subscription #{sub.id}: #{e.class}: #{e.message}")
      false
    end
  end
end
