require 'rails_helper'

RSpec.describe User, type: :model do
  subject { build(:user) }

  it { is_expected.to validate_presence_of(:name) }
  it { is_expected.to validate_presence_of(:email) }
  it { is_expected.to validate_uniqueness_of(:email).case_insensitive }

  it { is_expected.to have_many(:household_memberships).dependent(:destroy) }
  it { is_expected.to have_many(:households).through(:household_memberships) }
  it { is_expected.to have_many(:reminder_recipients).dependent(:destroy) }
end
