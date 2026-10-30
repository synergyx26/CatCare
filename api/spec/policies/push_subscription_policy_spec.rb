require "rails_helper"

RSpec.describe PushSubscriptionPolicy, type: :policy do
  let(:user)  { create(:user) }
  let(:other) { create(:user) }

  it "lets a user register a device and send themselves a test" do
    expect(described_class.new(user, PushSubscription)).to permit_actions(%i[create test])
  end

  it "only lets a user remove their own device" do
    expect(described_class.new(user, create(:push_subscription, user: user))).to permit_action(:destroy)
    expect(described_class.new(user, create(:push_subscription, user: other))).to forbid_action(:destroy)
  end
end
