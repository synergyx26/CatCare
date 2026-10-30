require "rails_helper"

RSpec.describe Notifications::Notifier do
  include ActiveJob::TestHelper

  let(:user) { create(:user) }

  def enable_push!(user, extra = {})
    prefs = user.notification_preferences.deep_dup
    prefs["push"] = prefs["push"].merge("enabled" => true).merge(extra)
    user.update!(notification_preferences: prefs)
  end

  it "always writes to the inbox" do
    expect { described_class.call(user, kind: "x", title: "T") }.to change { user.notifications.count }.by(1)
  end

  it "does not enqueue push when the user has not enabled it" do
    create(:push_subscription, user: user)
    expect { described_class.call(user, kind: "x", title: "T") }.not_to have_enqueued_job(DeliverPushNotificationJob)
  end

  it "does not enqueue push without a registered device" do
    enable_push!(user)
    expect { described_class.call(user, kind: "x", title: "T") }.not_to have_enqueued_job(DeliverPushNotificationJob)
  end

  it "enqueues push when enabled and a device exists" do
    enable_push!(user)
    create(:push_subscription, user: user)
    expect { described_class.call(user, kind: "x", title: "T") }.to have_enqueued_job(DeliverPushNotificationJob)
  end

  it "respects a disabled category" do
    enable_push!(user, "care_reminders" => false)
    create(:push_subscription, user: user)
    expect { described_class.call(user, kind: "x", title: "T", category: "care_reminders") }
      .not_to have_enqueued_job(DeliverPushNotificationJob)
  end
end
