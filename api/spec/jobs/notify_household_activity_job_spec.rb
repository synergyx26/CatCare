require "rails_helper"

RSpec.describe NotifyHouseholdActivityJob do
  include ActiveJob::TestHelper

  let(:household) { create(:household) }
  let(:actor)     { create(:user, name: "Matt") }
  let(:partner)   { create(:user) }
  let(:removed)   { create(:user) }

  before do
    create(:household_membership, household: household, user: actor,   role: :admin,  status: :active)
    create(:household_membership, household: household, user: partner, role: :member, status: :active)
    create(:household_membership, household: household, user: removed, role: :member, status: :removed)
  end

  def run(record, by: actor) = described_class.perform_now(record, by.id)
  def latest = partner.notifications.order(:id).last

  it "tells everyone but the person who did it (and not removed members)" do
    run(create(:cat, household: household, creator: actor, name: "Luna"))
    expect(partner.notifications.count).to eq(1)
    expect(actor.notifications).to be_empty
    expect(removed.notifications).to be_empty
  end

  it "announces a new cat" do
    cat = create(:cat, household: household, creator: actor, name: "Luna")
    run(cat)
    expect(latest).to have_attributes(kind: "cat.added", title: "Luna was added by Matt", url: "/households/#{household.id}/cats/#{cat.id}")
  end

  it "announces a care note" do
    note = household.care_notes.create!(title: "Vet food switch", body: "Moving to the new kibble gradually", category: :feeding, creator: actor)
    run(note)
    expect(latest).to have_attributes(kind: "note.added", title: "Matt added a note: Vet food switch", body: "Moving to the new kibble gradually")
  end

  it "announces an expense with its total" do
    expense = household.pet_expenses.create!(product_name: "Salmon pate", category: :food, unit_price: 2.5, quantity: 4, purchase_date: Date.today, created_by: actor)
    run(expense)
    expect(latest.title).to eq("Matt logged an expense: Salmon pate")
    expect(latest.body).to start_with("10.00")
  end

  it "announces a vacation trip, a reminder and a chore definition" do
    run(create(:vacation_trip, household: household, creator: actor))
    run(create(:reminder, cat: create(:cat, household: household, creator: actor), created_by: actor, title: "Breakfast"))
    run(household.household_chore_definitions.create!(name: "Water fountain", emoji: "💧"))
    expect(partner.notifications.pluck(:kind)).to include("trip.added", "reminder.added", "chore.defined")
  end

  it "announces a completed chore under care activity" do
    definition = household.household_chore_definitions.create!(name: "Litter boxes", emoji: "🧹")
    chore = household.household_chores.create!(chore_definition: definition, logged_by: actor, occurred_at: Time.current)
    run(chore)
    expect(latest).to have_attributes(kind: "chore.logged", title: "🧹 Litter boxes done by Matt")
  end

  it "tells existing members when someone joins, but not the joiner" do
    newcomer = create(:user, name: "Sam")
    membership = create(:household_membership, household: household, user: newcomer, role: :member, status: :active)
    described_class.perform_now(membership, newcomer.id)
    expect(partner.notifications.last.title).to eq("Sam joined #{household.name}")
    expect(newcomer.notifications).to be_empty
  end

  it "folds a quick burst from one person into one notification" do
    run(create(:cat, household: household, creator: actor, name: "Luna"))
    run(create(:cat, household: household, creator: actor, name: "Miso"))
    expect(partner.notifications.count).to eq(1)
    expect(latest).to have_attributes(title: "Matt added 2 cats", body: "Luna · Miso")
  end

  it "keeps separate kinds separate" do
    run(create(:cat, household: household, creator: actor, name: "Luna"))
    run(household.household_chore_definitions.create!(name: "Water fountain"))
    expect(partner.notifications.count).to eq(2)
  end

  describe "push preferences" do
    before { create(:push_subscription, user: partner) }

    def enable_push!(extra = {})
      prefs = partner.notification_preferences.deep_dup
      prefs["push"] = prefs["push"].merge("enabled" => true).merge(extra)
      partner.update!(notification_preferences: prefs)
    end

    it "pushes when the category is on (or never set)" do
      enable_push!
      expect { run(create(:cat, household: household, creator: actor)) }.to have_enqueued_job(DeliverPushNotificationJob)
    end

    it "keeps the inbox row but skips push when that category is off" do
      enable_push!("household_updates" => false)
      expect { run(create(:cat, household: household, creator: actor)) }.not_to have_enqueued_job(DeliverPushNotificationJob)
      expect(partner.notifications.count).to eq(1)
    end
  end
end

RSpec.describe "Additions notify the household", type: :request do
  include ActiveJob::TestHelper

  let(:household) { create(:household) }
  let(:admin)     { create(:user, subscription_tier: "premium") }

  before { create(:household_membership, household: household, user: admin, role: :admin, status: :active) }

  def auth_for(u)
    token, _payload = Warden::JWTAuth::UserEncoder.new.call(u, :user, nil)
    { "Authorization" => "Bearer #{token}" }
  end

  it "enqueues for a new cat" do
    expect {
      post "/api/v1/households/#{household.id}/cats", params: { cat: { name: "Luna", species: "cat" } }, headers: auth_for(admin), as: :json
    }.to have_enqueued_job(NotifyHouseholdActivityJob)
    expect(response).to have_http_status(:created)
  end

  it "enqueues for a new care note" do
    expect {
      post "/api/v1/households/#{household.id}/care_notes",
           params: { care_note: { title: "Hi", body: "There", category: "general" } }, headers: auth_for(admin), as: :json
    }.to have_enqueued_job(NotifyHouseholdActivityJob)
  end

  it "does not enqueue when the create is invalid" do
    expect {
      post "/api/v1/households/#{household.id}/care_notes", params: { care_note: { title: "", body: "", category: "general" } }, headers: auth_for(admin), as: :json
    }.not_to have_enqueued_job(NotifyHouseholdActivityJob)
  end
end
