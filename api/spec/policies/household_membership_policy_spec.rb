require 'rails_helper'

RSpec.describe HouseholdMembershipPolicy, type: :policy do
  let(:household)  { create(:household) }
  let(:admin)      { create(:user) }
  let(:member)     { create(:user) }
  let(:sitter)     { create(:user) }
  let(:outsider)   { create(:user) }
  let(:other_user) { create(:user) }

  # Memberships scoped to the shared household
  let!(:admin_membership)      { create(:household_membership, household: household, user: admin,      role: :admin,  status: :active) }
  let!(:member_membership)     { create(:household_membership, household: household, user: member,     role: :member, status: :active) }
  let!(:sitter_membership)     { create(:household_membership, household: household, user: sitter,     role: :sitter, status: :active) }
  let!(:other_user_membership) { create(:household_membership, household: household, user: other_user, role: :member, status: :active) }

  def policy_for(user, record)
    described_class.new(user, record)
  end

  # ── show? ──────────────────────────────────────────────────────────────────
  # A user may only view their own membership record.

  describe "show?" do
    it "permits a user viewing their own membership" do
      expect(policy_for(member, member_membership)).to permit_action(:show)
    end

    it "permits an admin viewing their own membership" do
      expect(policy_for(admin, admin_membership)).to permit_action(:show)
    end

    it "denies a user viewing another member's membership" do
      expect(policy_for(member, admin_membership)).not_to permit_action(:show)
    end

    it "denies a user viewing a sitter's membership" do
      expect(policy_for(member, sitter_membership)).not_to permit_action(:show)
    end

    it "denies an admin viewing another member's membership via show?" do
      # show? is own-record only; admin access goes through manage_update?/manage_destroy?
      expect(policy_for(admin, member_membership)).not_to permit_action(:show)
    end

    it "denies an outsider with no membership in this household" do
      outside_household = create(:household)
      outside_membership = create(:household_membership, household: outside_household, user: outsider, role: :admin, status: :active)
      expect(policy_for(outsider, outside_membership)).to permit_action(:show)
      expect(policy_for(outsider, member_membership)).not_to permit_action(:show)
    end
  end

  # ── update? ────────────────────────────────────────────────────────────────
  # A user may only update their own membership (profile fields: phone, notes, etc.)

  describe "update?" do
    it "permits a member updating their own membership" do
      expect(policy_for(member, member_membership)).to permit_action(:update)
    end

    it "permits an admin updating their own membership" do
      expect(policy_for(admin, admin_membership)).to permit_action(:update)
    end

    it "permits a sitter updating their own membership" do
      expect(policy_for(sitter, sitter_membership)).to permit_action(:update)
    end

    it "denies a member updating another member's membership" do
      expect(policy_for(member, other_user_membership)).not_to permit_action(:update)
    end

    it "denies an admin updating another member's membership via update?" do
      # Admins use manage_update? for role changes; update? is self-only
      expect(policy_for(admin, member_membership)).not_to permit_action(:update)
    end
  end

  # ── manage_update? ─────────────────────────────────────────────────────────
  # An admin may change another member's role but NOT their own.

  describe "manage_update?" do
    it "permits an admin managing another member's membership" do
      expect(policy_for(admin, member_membership)).to permit_action(:manage_update)
    end

    it "permits an admin managing a sitter's membership" do
      expect(policy_for(admin, sitter_membership)).to permit_action(:manage_update)
    end

    it "denies an admin managing their own membership (own_membership? guard)" do
      expect(policy_for(admin, admin_membership)).not_to permit_action(:manage_update)
    end

    it "denies a regular member managing another's membership" do
      expect(policy_for(member, other_user_membership)).not_to permit_action(:manage_update)
    end

    it "denies a sitter managing any membership" do
      expect(policy_for(sitter, member_membership)).not_to permit_action(:manage_update)
    end

    it "denies a user with no active membership in this household" do
      # outsider has no membership in `household`
      expect(policy_for(outsider, member_membership)).not_to permit_action(:manage_update)
    end

    context "when the admin's own membership is inactive (removed/pending)" do
      let!(:inactive_admin) { create(:user) }
      before do
        create(:household_membership, household: household, user: inactive_admin, role: :admin, status: :removed)
      end

      it "denies a removed admin from managing memberships" do
        expect(policy_for(inactive_admin, member_membership)).not_to permit_action(:manage_update)
      end
    end
  end

  # ── manage_destroy? ────────────────────────────────────────────────────────
  # Same rules as manage_update? — admin can remove others but not themselves.

  describe "manage_destroy?" do
    it "permits an admin destroying another member's membership" do
      expect(policy_for(admin, member_membership)).to permit_action(:manage_destroy)
    end

    it "permits an admin destroying a sitter's membership" do
      expect(policy_for(admin, sitter_membership)).to permit_action(:manage_destroy)
    end

    it "denies an admin destroying their own membership (own_membership? guard)" do
      expect(policy_for(admin, admin_membership)).not_to permit_action(:manage_destroy)
    end

    it "denies a regular member removing another member" do
      expect(policy_for(member, other_user_membership)).not_to permit_action(:manage_destroy)
    end

    it "denies a sitter removing any membership" do
      expect(policy_for(sitter, other_user_membership)).not_to permit_action(:manage_destroy)
    end

    it "denies a user with no membership in this household" do
      expect(policy_for(outsider, member_membership)).not_to permit_action(:manage_destroy)
    end
  end
end
