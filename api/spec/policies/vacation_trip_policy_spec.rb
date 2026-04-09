require 'rails_helper'

RSpec.describe VacationTripPolicy, type: :policy do
  let(:household) { create(:household) }
  let(:admin)     { create(:user) }
  let(:member)    { create(:user) }
  let(:sitter)    { create(:user) }
  let(:outsider)  { create(:user) }

  let!(:admin_membership)  { create(:household_membership, household: household, user: admin,  role: :admin,  status: :active) }
  let!(:member_membership) { create(:household_membership, household: household, user: member, role: :member, status: :active) }
  let!(:sitter_membership) { create(:household_membership, household: household, user: sitter, role: :sitter, status: :active) }

  let(:trip) { create(:vacation_trip, household: household, creator: admin) }

  def policy_for(user, record)
    described_class.new(user, record)
  end

  # ── index? ──────────────────────────────────────────────────────────────────
  # Any active household member can see the trip list.

  describe "index?" do
    it "permits an admin" do
      expect(policy_for(admin, household)).to permit_action(:index)
    end

    it "permits a member" do
      expect(policy_for(member, household)).to permit_action(:index)
    end

    it "permits a sitter" do
      expect(policy_for(sitter, household)).to permit_action(:index)
    end

    it "denies an outsider with no membership" do
      expect(policy_for(outsider, household)).not_to permit_action(:index)
    end
  end

  # ── create? ─────────────────────────────────────────────────────────────────
  # Only admins can create trips.

  describe "create?" do
    it "permits an admin" do
      expect(policy_for(admin, trip)).to permit_action(:create)
    end

    it "denies a member" do
      expect(policy_for(member, trip)).not_to permit_action(:create)
    end

    it "denies a sitter" do
      expect(policy_for(sitter, trip)).not_to permit_action(:create)
    end

    it "denies an outsider" do
      expect(policy_for(outsider, trip)).not_to permit_action(:create)
    end
  end

  # ── update? ─────────────────────────────────────────────────────────────────
  # Only admins can update trips.

  describe "update?" do
    it "permits an admin" do
      expect(policy_for(admin, trip)).to permit_action(:update)
    end

    it "denies a member" do
      expect(policy_for(member, trip)).not_to permit_action(:update)
    end

    it "denies a sitter" do
      expect(policy_for(sitter, trip)).not_to permit_action(:update)
    end
  end

  # ── destroy? ────────────────────────────────────────────────────────────────
  # Only admins can delete trips.

  describe "destroy?" do
    it "permits an admin" do
      expect(policy_for(admin, trip)).to permit_action(:destroy)
    end

    it "denies a member" do
      expect(policy_for(member, trip)).not_to permit_action(:destroy)
    end

    it "denies a sitter" do
      expect(policy_for(sitter, trip)).not_to permit_action(:destroy)
    end

    it "denies an outsider" do
      expect(policy_for(outsider, trip)).not_to permit_action(:destroy)
    end

    context "when the membership is inactive (removed)" do
      let(:removed_admin) { create(:user) }
      before do
        create(:household_membership, household: household, user: removed_admin,
               role: :admin, status: :removed)
      end

      it "denies a removed admin" do
        expect(policy_for(removed_admin, trip)).not_to permit_action(:destroy)
      end
    end
  end
end
