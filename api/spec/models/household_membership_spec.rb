require 'rails_helper'

RSpec.describe HouseholdMembership, type: :model do
  subject { build(:household_membership) }

  it { is_expected.to belong_to(:household) }
  it { is_expected.to belong_to(:user) }

  it { is_expected.to validate_uniqueness_of(:user_id).scoped_to(:household_id) }

  it "defines role enum with expected values" do
    expect(described_class.roles.keys).to match_array(%w[member admin sitter])
  end

  it "defines status enum with expected values" do
    expect(described_class.statuses.keys).to match_array(%w[pending active removed])
  end
end
