require 'rails_helper'

RSpec.describe UserPolicy, type: :policy do
  let(:user)  { create(:user) }
  let(:other) { create(:user) }

  describe "update_notification_preferences?" do
    it "permits a user to update their own notification preferences" do
      expect(described_class.new(user, user)).to permit_action(:update_notification_preferences)
    end

    it "denies a user from updating another user's notification preferences" do
      expect(described_class.new(user, other)).not_to permit_action(:update_notification_preferences)
    end
  end
end
