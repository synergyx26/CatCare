require 'rails_helper'

RSpec.describe CatPolicy, type: :policy do
  let(:household) { create(:household) }
  let(:cat)       { create(:cat, household: household, creator: create(:user)) }

  def policy_for(user, record)
    described_class.new(user, record)
  end

  shared_examples "can read cats" do |user_let|
    it "permits show" do
      expect(policy_for(send(user_let), cat)).to permit_action(:show)
    end

    it "permits stats" do
      expect(policy_for(send(user_let), cat)).to permit_action(:stats)
    end

    it "permits index (scoped to household)" do
      expect(policy_for(send(user_let), household)).to permit_action(:index)
    end
  end

  shared_examples "can write cats" do |user_let|
    it "permits create" do
      expect(policy_for(send(user_let), cat)).to permit_action(:create)
    end

    it "permits update" do
      expect(policy_for(send(user_let), cat)).to permit_action(:update)
    end
  end

  shared_examples "cannot write cats" do |user_let|
    it "denies create" do
      expect(policy_for(send(user_let), cat)).not_to permit_action(:create)
    end

    it "denies update" do
      expect(policy_for(send(user_let), cat)).not_to permit_action(:update)
    end
  end

  context "when user is an active admin" do
    let(:admin) { create(:user) }
    before { create(:household_membership, user: admin, household: household, role: :admin, status: :active) }

    include_examples "can read cats", :admin
    include_examples "can write cats", :admin
  end

  context "when user is an active member" do
    let(:member) { create(:user) }
    before { create(:household_membership, user: member, household: household, role: :member, status: :active) }

    include_examples "can read cats", :member
    include_examples "can write cats", :member
  end

  context "when user is an active sitter" do
    let(:sitter) { create(:user) }
    before { create(:household_membership, user: sitter, household: household, role: :sitter, status: :active) }

    include_examples "can read cats", :sitter
    include_examples "cannot write cats", :sitter
  end

  context "when user has no membership" do
    let(:outsider) { create(:user) }

    it "denies show" do
      expect(policy_for(outsider, cat)).not_to permit_action(:show)
    end

    it "denies index" do
      expect(policy_for(outsider, household)).not_to permit_action(:index)
    end

    include_examples "cannot write cats", :outsider
  end

  context "when membership is not active (pending/removed)" do
    let(:pending_user) { create(:user) }
    before { create(:household_membership, user: pending_user, household: household, role: :member, status: :pending) }

    it "denies show" do
      expect(policy_for(pending_user, cat)).not_to permit_action(:show)
    end
  end
end
