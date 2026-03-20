require 'rails_helper'

RSpec.describe HouseholdInvitePolicy, type: :policy do
  # record is always the Household for this policy
  let(:household) { create(:household) }

  def policy_for(user)
    described_class.new(user, household)
  end

  context "when user is an admin" do
    let(:admin) { create(:user) }
    before { create(:household_membership, user: admin, household: household, role: :admin, status: :active) }

    it { expect(policy_for(admin)).to permit_action(:index) }
    it { expect(policy_for(admin)).to permit_action(:create) }
    it { expect(policy_for(admin)).to permit_action(:destroy) }
  end

  context "when user is a member (non-sitter)" do
    let(:member) { create(:user) }
    before { create(:household_membership, user: member, household: household, role: :member, status: :active) }

    it { expect(policy_for(member)).to permit_action(:index) }
    it { expect(policy_for(member)).not_to permit_action(:create) }
    it { expect(policy_for(member)).not_to permit_action(:destroy) }
  end

  context "when user is a sitter" do
    let(:sitter) { create(:user) }
    before { create(:household_membership, user: sitter, household: household, role: :sitter, status: :active) }

    it { expect(policy_for(sitter)).not_to permit_action(:index) }
    it { expect(policy_for(sitter)).not_to permit_action(:create) }
    it { expect(policy_for(sitter)).not_to permit_action(:destroy) }
  end

  context "when user is not a member" do
    let(:outsider) { create(:user) }

    it { expect(policy_for(outsider)).not_to permit_action(:index) }
    it { expect(policy_for(outsider)).not_to permit_action(:create) }
    it { expect(policy_for(outsider)).not_to permit_action(:destroy) }
  end
end
