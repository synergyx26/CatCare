require 'rails_helper'

RSpec.describe User, type: :model do
  subject { build(:user) }

  it { is_expected.to validate_presence_of(:name) }
  it { is_expected.to validate_presence_of(:email) }
  it { is_expected.to validate_uniqueness_of(:email).case_insensitive }

  it { is_expected.to have_many(:household_memberships).dependent(:destroy) }
  it { is_expected.to have_many(:households).through(:household_memberships) }
  it { is_expected.to have_many(:reminder_recipients).dependent(:destroy) }

  describe ".super_admin_email?" do
    around do |example|
      original = ENV["SUPER_ADMIN_EMAIL"]
      ENV["SUPER_ADMIN_EMAIL"] = "admin@example.com, Second.Admin@Example.com"
      example.run
      ENV["SUPER_ADMIN_EMAIL"] = original
    end

    it "matches any email in the comma-separated list, case-insensitively" do
      expect(User.super_admin_email?("admin@example.com")).to be true
      expect(User.super_admin_email?("ADMIN@EXAMPLE.COM")).to be true
      expect(User.super_admin_email?("second.admin@example.com")).to be true
    end

    it "does not match emails outside the list" do
      expect(User.super_admin_email?("nobody@example.com")).to be false
    end

    it "returns false for blank input" do
      expect(User.super_admin_email?(nil)).to be false
      expect(User.super_admin_email?("")).to be false
    end
  end
end
