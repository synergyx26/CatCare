require "rails_helper"

RSpec.describe NotificationPolicy, type: :policy do
  let(:user)  { create(:user) }
  let(:other) { create(:user) }
  let(:own)   { create(:notification, user: user) }
  let(:theirs) { create(:notification, user: other) }

  it "lets a user update and destroy their own notification" do
    expect(described_class.new(user, own)).to permit_actions(%i[update destroy])
  end

  it "denies updating or destroying someone else's notification" do
    expect(described_class.new(user, theirs)).to forbid_actions(%i[update destroy])
  end

  it "scopes to the user's own notifications" do
    own; theirs
    expect(described_class::Scope.new(user, Notification).resolve).to contain_exactly(own)
  end
end
