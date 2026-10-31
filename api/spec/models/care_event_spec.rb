require 'rails_helper'

RSpec.describe CareEvent, type: :model do
  subject { build(:care_event) }

  it { is_expected.to belong_to(:cat) }
  it { is_expected.to belong_to(:household) }
  it { is_expected.to belong_to(:logged_by).class_name("User") }

  it { is_expected.to validate_presence_of(:event_type) }

  describe "occurred_at default" do
    it "is set to current time when not provided" do
      event = build(:care_event, occurred_at: nil)
      event.valid?
      expect(event.occurred_at).to be_present
    end

    it "preserves an explicitly set occurred_at" do
      time  = 2.days.ago
      event = build(:care_event, occurred_at: time)
      event.valid?
      expect(event.occurred_at).to be_within(1.second).of(time)
    end
  end

  describe "medication supply details" do
    def med_event(details)
      build(:care_event, event_type: :medication, details: { "medication_name" => "Fluticasone" }.merge(details))
    end

    let(:valid_supply) do
      {
        "active_medication"    => true,
        "supply_quantity"      => 120,
        "supply_unit"          => "puffs",
        "supply_per_dose"      => 2,
        "supply_low_threshold" => 20,
        "supply_refilled_at"   => "2026-09-01T08:00:00.000Z",
      }
    end

    it "accepts a complete supply snapshot" do
      expect(med_event(valid_supply)).to be_valid
    end

    it "accepts medication events without any supply fields" do
      expect(med_event({})).to be_valid
    end

    it "accepts a dose event with supply_used" do
      expect(med_event("supply_used" => 1.5)).to be_valid
    end

    it "accepts numeric strings" do
      expect(med_event(valid_supply.merge("supply_quantity" => "60"))).to be_valid
    end

    it "rejects a negative quantity" do
      expect(med_event(valid_supply.merge("supply_quantity" => -1))).not_to be_valid
    end

    it "rejects a non-numeric quantity" do
      expect(med_event(valid_supply.merge("supply_quantity" => "lots"))).not_to be_valid
    end

    it "rejects a quantity above the maximum" do
      expect(med_event(valid_supply.merge("supply_quantity" => CareEvent::SUPPLY_MAX + 1))).not_to be_valid
    end

    it "rejects a zero supply_per_dose" do
      expect(med_event(valid_supply.merge("supply_per_dose" => 0))).not_to be_valid
    end

    it "rejects a negative supply_used" do
      expect(med_event("supply_used" => -2)).not_to be_valid
    end

    it "rejects a blank or overlong supply_unit" do
      expect(med_event(valid_supply.merge("supply_unit" => "  "))).not_to be_valid
      expect(med_event(valid_supply.merge("supply_unit" => "x" * 31))).not_to be_valid
      expect(med_event(valid_supply.merge("supply_unit" => 5))).not_to be_valid
    end

    it "rejects a malformed supply_refilled_at" do
      expect(med_event(valid_supply.merge("supply_refilled_at" => "yesterday"))).not_to be_valid
    end

    it "requires supply_refilled_at alongside supply_quantity" do
      expect(med_event(valid_supply.except("supply_refilled_at"))).not_to be_valid
    end

    describe "new supply entries" do
      let(:refill) { { "supply_refill" => true, "supply_quantity" => 200, "supply_unit" => "puffs" } }

      it "accepts a new supply without supply_refilled_at (occurred_at is the count time)" do
        expect(med_event(refill)).to be_valid
      end

      it "requires supply_quantity" do
        expect(med_event(refill.except("supply_quantity"))).not_to be_valid
      end

      it "rejects a new supply flagged as a medication start" do
        expect(med_event(refill.merge("active_medication" => true))).not_to be_valid
      end

      it "rejects a non-boolean supply_refill" do
        expect(med_event(refill.merge("supply_refill" => "yes"))).not_to be_valid
      end

      it "rejects a negative new supply quantity" do
        expect(med_event(refill.merge("supply_quantity" => -10))).not_to be_valid
      end
    end

    it "does not validate supply keys on non-medication events" do
      event = build(:care_event, event_type: :note, details: { "supply_quantity" => -5 })
      expect(event).to be_valid
    end
  end
end
