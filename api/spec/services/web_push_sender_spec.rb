require "rails_helper"

RSpec.describe Notifications::WebPushSender do
  let(:user) { create(:user) }
  let!(:sub) { create(:push_subscription, user: user) }

  before do
    stub_const("ENV", ENV.to_h.merge("VAPID_PUBLIC_KEY" => "pub", "VAPID_PRIVATE_KEY" => "priv"))
  end

  it "is a no-op when VAPID keys are missing" do
    stub_const("ENV", ENV.to_h.except("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"))
    expect(WebPush).not_to receive(:payload_send)
    expect(described_class.deliver(user, title: "x")).to eq(0)
  end

  it "counts successful deliveries" do
    allow(WebPush).to receive(:payload_send).and_return(true)
    expect(described_class.deliver(user, title: "x")).to eq(1)
  end

  it "removes a subscription the push service says is gone" do
    allow(WebPush).to receive(:payload_send).and_raise(WebPush::ExpiredSubscription.new(Struct.new(:body, :inspect).new("", ""), "host"))
    expect(described_class.deliver(user, title: "x")).to eq(0)
    expect(PushSubscription.exists?(sub.id)).to be(false)
  end

  it "keeps the subscription and does not raise on transient errors" do
    allow(WebPush).to receive(:payload_send).and_raise(StandardError, "boom")
    expect(described_class.deliver(user, title: "x")).to eq(0)
    expect(PushSubscription.exists?(sub.id)).to be(true)
  end
end
