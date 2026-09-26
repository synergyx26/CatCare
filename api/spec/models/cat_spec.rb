require 'rails_helper'

RSpec.describe Cat, type: :model do
  subject { build(:cat) }

  it { is_expected.to belong_to(:household) }
  it { is_expected.to belong_to(:creator).class_name("User") }
  it { is_expected.to have_many(:care_events).dependent(:destroy) }
  it { is_expected.to have_many(:reminders).dependent(:destroy) }

  it { is_expected.to validate_presence_of(:name) }
  it { is_expected.to validate_presence_of(:species) }

  it { is_expected.to validate_numericality_of(:feedings_per_day).only_integer.is_greater_than(0).is_less_than_or_equal_to(10) }
  it { is_expected.to allow_value(true, false).for(:track_water) }
  it { is_expected.to allow_value(true, false).for(:track_litter) }

  describe ".active" do
    it "returns only cats where active is true" do
      household = create(:household)
      creator   = create(:user)
      active    = create(:cat, household: household, creator: creator, active: true)
      inactive  = create(:cat, household: household, creator: creator, active: false)

      expect(Cat.active).to include(active)
      expect(Cat.active).not_to include(inactive)
    end
  end

  describe "appearance" do
    let(:valid) { { "pattern" => "tabby", "fur" => "#F0A050", "fur2" => "#a86a30", "eyes" => "#c98a2b" } }

    it "is optional" do
      expect(build(:cat, appearance: nil)).to be_valid
    end

    it "accepts a complete look and normalises hex colours to lowercase" do
      cat = build(:cat, appearance: valid)
      expect(cat).to be_valid
      expect(cat.appearance["fur"]).to eq("#f0a050")
    end

    it "drops blank optional colours" do
      cat = build(:cat, appearance: valid.merge("fur3" => ""))
      expect(cat).to be_valid
      expect(cat.appearance).not_to have_key("fur3")
    end

    it "rejects an unknown pattern" do
      cat = build(:cat, appearance: valid.merge("pattern" => "plaid"))
      expect(cat).not_to be_valid
      expect(cat.errors[:appearance].join).to include("pattern")
    end

    it "rejects colours that aren't #rrggbb" do
      cat = build(:cat, appearance: valid.merge("eyes" => "green"))
      expect(cat).not_to be_valid
      expect(cat.errors[:appearance].join).to include("eyes")
    end

    it "rejects missing required keys" do
      cat = build(:cat, appearance: { "pattern" => "solid" })
      expect(cat).not_to be_valid
      expect(cat.errors[:appearance].join).to include("fur", "eyes")
    end

    it "rejects unknown keys" do
      cat = build(:cat, appearance: valid.merge("wings" => "#ffffff"))
      expect(cat).not_to be_valid
      expect(cat.errors[:appearance].join).to include("wings")
    end

    it "rejects a non-object value" do
      cat = build(:cat, appearance: "tabby")
      expect(cat).not_to be_valid
      expect(cat.errors[:appearance]).to include("must be an object")
    end
  end
end
