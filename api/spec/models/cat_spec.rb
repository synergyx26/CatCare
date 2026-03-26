require 'rails_helper'

RSpec.describe Cat, type: :model do
  subject { build(:cat) }

  it { is_expected.to belong_to(:household) }
  it { is_expected.to belong_to(:creator).class_name("User") }
  it { is_expected.to have_many(:care_events).dependent(:destroy) }
  it { is_expected.to have_many(:reminders).dependent(:destroy) }

  it { is_expected.to validate_presence_of(:name) }
  it { is_expected.to validate_presence_of(:species) }

  it { is_expected.to validate_numericality_of(:feedings_per_day).only_integer.is_greater_than(0).is_less_than_or_equal_to(10) }
  it { is_expected.to allow_value(true, false).for(:track_water) }
  it { is_expected.to allow_value(true, false).for(:track_litter) }

  describe ".active" do
    it "returns only cats where active is true" do
      household = create(:household)
      creator   = create(:user)
      active    = create(:cat, household: household, creator: creator, active: true)
      inactive  = create(:cat, household: household, creator: creator, active: false)

      expect(Cat.active).to include(active)
      expect(Cat.active).not_to include(inactive)
    end
  end
end
