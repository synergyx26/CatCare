require 'rails_helper'

RSpec.describe CareEventPolicy, type: :policy do
  let(:household) { create(:household) }
  let(:owner)     { create(:user) }
  let(:event)     { create(:care_event, household: household, logged_by: owner, cat: create(:cat, household: household, creator: owner)) }

  before { create(:household_membership, user: owner, household: household, role: :sitter, status: :active) }

  def policy_for(user, record)
    described_class.new(user, record)
  end

  context "when user is an admin" do
    let(:admin) { create(:user) }
    before { create(:household_membership, user: admin, household: household, role: :admin, status: :active) }

    it { expect(policy_for(admin, household)).to permit_action(:index) }
    it { expect(policy_for(admin, event)).to permit_action(:create) }
    it { expect(policy_for(admin, event)).to permit_action(:update) }
    it { expect(policy_for(admin, event)).to permit_action(:destroy) }
  end

  context "when user is a member" do
    let(:member) { create(:user) }
    before { create(:household_membership, user: member, household: household, role: :member, status: :active) }

    it { expect(policy_for(member, household)).to permit_action(:index) }
    it { expect(policy_for(member, event)).to permit_action(:create) }
    it { expect(policy_for(member, event)).to permit_action(:update) }
    it { expect(policy_for(member, event)).to permit_action(:destroy) }
  end

  context "when user is a sitter" do
    let(:other_sitter) { create(:user) }
    before { create(:household_membership, user: other_sitter, household: household, role: :sitter, status: :active) }

    it { expect(policy_for(other_sitter, household)).to permit_action(:index) }
    it { expect(policy_for(other_sitter, event)).to permit_action(:create) }

    it "denies update on someone else's event" do
      expect(policy_for(other_sitter, event)).not_to permit_action(:update)
    end

    it "denies destroy on someone else's event" do
      expect(policy_for(other_sitter, event)).not_to permit_action(:destroy)
    end

    it "permits update on own event" do
      own_event = create(:care_event, household: household, logged_by: other_sitter, cat: event.cat)
      expect(policy_for(other_sitter, own_event)).to permit_action(:update)
    end

    it "permits destroy on own event" do
      own_event = create(:care_event, household: household, logged_by: other_sitter, cat: event.cat)
      expect(policy_for(other_sitter, own_event)).to permit_action(:destroy)
    end
  end

  context "when user is not a member" do
    let(:outsider) { create(:user) }

    it { expect(policy_for(outsider, household)).not_to permit_action(:index) }
    it { expect(policy_for(outsider, event)).not_to permit_action(:create) }
    it { expect(policy_for(outsider, event)).not_to permit_action(:update) }
    it { expect(policy_for(outsider, event)).not_to permit_action(:destroy) }
  end
end
