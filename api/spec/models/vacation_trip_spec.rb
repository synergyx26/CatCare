require 'rails_helper'

RSpec.describe VacationTrip, type: :model do
  subject { build(:vacation_trip) }

  it { is_expected.to belong_to(:household) }
  it { is_expected.to belong_to(:creator).class_name("User") }
  it { is_expected.to validate_presence_of(:start_date) }
  it do
    is_expected.to validate_numericality_of(:sitter_visit_frequency_days)
      .is_greater_than_or_equal_to(1)
      .is_less_than_or_equal_to(30)
      .only_integer
  end

  describe "end_date_not_before_start_date" do
    it "is invalid when end_date is before start_date" do
      trip = build(:vacation_trip, start_date: Date.today, end_date: Date.yesterday)
      expect(trip).not_to be_valid
      expect(trip.errors[:end_date]).to be_present
    end

    it "is valid when end_date equals start_date" do
      trip = build(:vacation_trip, start_date: Date.today, end_date: Date.today)
      expect(trip).to be_valid
    end

    it "is valid when end_date is after start_date" do
      trip = build(:vacation_trip, start_date: Date.today, end_date: 3.days.from_now.to_date)
      expect(trip).to be_valid
    end

    it "is valid when end_date is nil (open-ended trip)" do
      trip = build(:vacation_trip, start_date: Date.today, end_date: nil)
      expect(trip).to be_valid
    end
  end

  describe "#active?" do
    it "returns true when today is within the trip range" do
      trip = build(:vacation_trip,
                   start_date: 1.day.ago.to_date,
                   end_date: 1.day.from_now.to_date)
      expect(trip.active?).to be true
    end

    it "returns false when the trip has ended" do
      trip = build(:vacation_trip,
                   start_date: 3.days.ago.to_date,
                   end_date: 1.day.ago.to_date)
      expect(trip.active?).to be false
    end

    it "returns true when end_date is nil (open-ended)" do
      trip = build(:vacation_trip,
                   start_date: 1.day.ago.to_date,
                   end_date: nil)
      expect(trip.active?).to be true
    end

    it "returns false when the trip has not started yet" do
      trip = build(:vacation_trip,
                   start_date: 1.day.from_now.to_date,
                   end_date: nil)
      expect(trip.active?).to be false
    end

    it "returns true when trip starts and ends today" do
      trip = build(:vacation_trip,
                   start_date: Date.today,
                   end_date: Date.today)
      expect(trip.active?).to be true
    end
  end

  describe ".active_on scope" do
    let(:household) { create(:household) }
    let(:user)      { create(:user) }

    it "returns trips active on the given date" do
      active = create(:vacation_trip, household: household, creator: user,
                      start_date: 2.days.ago.to_date, end_date: 2.days.from_now.to_date)
      create(:vacation_trip, household: household, creator: user,
             start_date: 5.days.ago.to_date, end_date: 3.days.ago.to_date)

      expect(VacationTrip.active_on(Date.today)).to include(active)
      expect(VacationTrip.active_on(Date.today).count).to eq(1)
    end

    it "includes open-ended trips" do
      open_trip = create(:vacation_trip, household: household, creator: user,
                         start_date: 1.day.ago.to_date, end_date: nil)
      expect(VacationTrip.active_on(Date.today)).to include(open_trip)
    end
  end
end
