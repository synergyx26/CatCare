require 'rails_helper'

RSpec.describe CareEvent, type: :model do
  subject { build(:care_event) }

  it { is_expected.to belong_to(:cat) }
  it { is_expected.to belong_to(:household) }
  it { is_expected.to belong_to(:logged_by).class_name("User") }

  it { is_expected.to validate_presence_of(:event_type) }

  describe "occurred_at default" do
    it "is set to current time when not provided" do
      event = build(:care_event, occurred_at: nil)
      event.valid?
      expect(event.occurred_at).to be_present
    end

    it "preserves an explicitly set occurred_at" do
      time  = 2.days.ago
      event = build(:care_event, occurred_at: time)
      event.valid?
      expect(event.occurred_at).to be_within(1.second).of(time)
    end
  end
end
