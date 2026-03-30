require 'rails_helper'

RSpec.describe ReminderPolicy, type: :policy do
  let(:household) { create(:household) }
  let(:admin)     { create(:user) }
  let(:member)    { create(:user) }
  let(:sitter)    { create(:user) }
  let(:outsider)  { create(:user) }

  let!(:admin_membership)  { create(:household_membership, household: household, user: admin,  role: :admin,  status: :active) }
  let!(:member_membership) { create(:household_membership, household: household, user: member, role: :member, status: :active) }
  let!(:sitter_membership) { create(:household_membership, household: household, user: sitter, role: :sitter, status: :active) }

  let(:cat) { create(:cat, household: household, creator: admin) }

  # A reminder created by the admin
  let(:admin_reminder) do
    create(:reminder, cat: cat, household: household, created_by: admin)
  end

  # A reminder created by the sitter (for testing sitter-owns-own rules)
  let(:sitter_reminder) do
    create(:reminder, cat: cat, household: household, created_by: sitter)
  end

  def policy_for(user, record)
    described_class.new(user, record)
  end

  # ── index? ─────────────────────────────────────────────────────────────────
  # Any active member (including sitters) can view the reminder list.

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

  # ── create? ────────────────────────────────────────────────────────────────
  # Only non-sitter active members can create reminders.

  describe "create?" do
    it "permits an admin creating a reminder" do
      expect(policy_for(admin, admin_reminder)).to permit_action(:create)
    end

    it "permits a member creating a reminder" do
      expect(policy_for(member, admin_reminder)).to permit_action(:create)
    end

    it "denies a sitter creating a reminder" do
      expect(policy_for(sitter, admin_reminder)).not_to permit_action(:create)
    end

    it "denies an outsider with no membership" do
      expect(policy_for(outsider, admin_reminder)).not_to permit_action(:create)
    end
  end

  # ── show? ──────────────────────────────────────────────────────────────────
  # Any active member can view/test-send a reminder (super-admin gate is in controller).

  describe "show?" do
    it "permits an admin" do
      expect(policy_for(admin, admin_reminder)).to permit_action(:show)
    end

    it "permits a sitter" do
      expect(policy_for(sitter, admin_reminder)).to permit_action(:show)
    end

    it "denies an outsider" do
      expect(policy_for(outsider, admin_reminder)).not_to permit_action(:show)
    end
  end

  # ── update? ────────────────────────────────────────────────────────────────
  # Same rules as destroy: non-sitters can edit any; sitters only their own.

  describe "update?" do
    it "permits an admin updating any reminder" do
      expect(policy_for(admin, admin_reminder)).to permit_action(:update)
    end

    it "permits a member updating any reminder" do
      expect(policy_for(member, admin_reminder)).to permit_action(:update)
    end

    it "permits a sitter updating their own reminder" do
      expect(policy_for(sitter, sitter_reminder)).to permit_action(:update)
    end

    it "denies a sitter updating another user's reminder" do
      expect(policy_for(sitter, admin_reminder)).not_to permit_action(:update)
    end

    it "denies an outsider with no membership" do
      expect(policy_for(outsider, admin_reminder)).not_to permit_action(:update)
    end
  end

  # ── destroy? ───────────────────────────────────────────────────────────────
  # Admins/members can delete any reminder. Sitters can only delete their own.

  describe "destroy?" do
    it "permits an admin deleting any reminder" do
      expect(policy_for(admin, admin_reminder)).to permit_action(:destroy)
    end

    it "permits a member deleting any reminder" do
      expect(policy_for(member, admin_reminder)).to permit_action(:destroy)
    end

    it "permits a sitter deleting their own reminder" do
      expect(policy_for(sitter, sitter_reminder)).to permit_action(:destroy)
    end

    it "denies a sitter deleting another user's reminder" do
      expect(policy_for(sitter, admin_reminder)).not_to permit_action(:destroy)
    end

    it "denies an outsider with no membership" do
      expect(policy_for(outsider, admin_reminder)).not_to permit_action(:destroy)
    end

    context "when the membership is inactive (removed)" do
      let(:removed_user) { create(:user) }
      before do
        create(:household_membership, household: household, user: removed_user,
               role: :member, status: :removed)
      end

      it "denies a removed member from deleting reminders" do
        expect(policy_for(removed_user, admin_reminder)).not_to permit_action(:destroy)
      end
    end
  end
end
