require "rails_helper"

RSpec.describe NotifyCareEventJob do
  include ActiveJob::TestHelper

  let(:household) { create(:household) }
  let(:actor)     { create(:user, name: "Matt") }
  let(:partner)   { create(:user) }
  let(:sitter)    { create(:user) }
  let(:removed)   { create(:user) }
  let(:cat)       { create(:cat, household: household, creator: actor, name: "Miso") }

  before do
    create(:household_membership, household: household, user: actor,   role: :admin,  status: :active)
    create(:household_membership, household: household, user: partner, role: :member, status: :active)
    create(:household_membership, household: household, user: sitter,  role: :sitter, status: :active)
    create(:household_membership, household: household, user: removed, role: :member, status: :removed)
  end

  def log(type: :feeding, at: Time.current, **attrs)
    create(:care_event, household: household, cat: cat, logged_by: actor, event_type: type, occurred_at: at, **attrs)
  end

  it "notifies every other active member but not the person who logged it" do
    described_class.perform_now(log.id)
    expect(partner.notifications.pluck(:kind)).to eq(["care.logged"])
    expect(sitter.notifications.count).to eq(1)
    expect(actor.notifications).to be_empty
    expect(removed.notifications).to be_empty
  end

  it "says who did what to which cat" do
    described_class.perform_now(log(type: :litter).id)
    expect(partner.notifications.last.title).to eq("Miso's litter cleaned by Matt")
  end

  it "adds the feeding details as the body" do
    described_class.perform_now(log(details: { "food_type" => "Chicken", "amount_grams" => 50, "unit" => "g" }).id)
    expect(partner.notifications.last.body).to eq("Chicken · 50 g")
  end

  it "folds a quick burst from one person into a single notification" do
    other = create(:cat, household: household, creator: actor, name: "Luna")
    described_class.perform_now(log.id)
    described_class.perform_now(create(:care_event, household: household, cat: other, logged_by: actor, event_type: :feeding, occurred_at: Time.current).id)

    expect(partner.notifications.count).to eq(1)
    n = partner.notifications.last
    expect(n.title).to eq("Matt logged 2 care items")
    expect(n.body).to eq("Miso fed · Luna fed")
    expect(n.url).to eq("/dashboard")
  end

  it "starts a new notification once the previous one has been read" do
    described_class.perform_now(log.id)
    partner.notifications.update_all(read_at: Time.current)
    described_class.perform_now(log.id)
    expect(partner.notifications.count).to eq(2)
  end

  it "stays quiet for back-filled history and future-dated entries" do
    described_class.perform_now(log(at: 2.days.ago).id)
    described_class.perform_now(log(type: :vet_visit, at: 3.days.from_now).id)
    expect(partner.notifications).to be_empty
  end

  it "does not blow up when the logger's account is gone" do
    event = log
    event.update_columns(logged_by_id: nil)
    described_class.perform_now(event.id)
    expect(partner.notifications.last.title).to eq("Miso fed by Someone")
  end

  describe "push delivery" do
    before do
      create(:push_subscription, user: partner)
    end

    def enable_push!(extra = {})
      prefs = partner.notification_preferences.deep_dup
      prefs["push"] = prefs["push"].merge("enabled" => true).merge(extra)
      partner.update!(notification_preferences: prefs)
    end

    it "pushes to a member who opted in" do
      enable_push!
      expect { described_class.perform_now(log.id) }.to have_enqueued_job(DeliverPushNotificationJob)
    end

    it "does not push when they switched off care activity" do
      enable_push!("care_activity" => false)
      expect { described_class.perform_now(log.id) }.not_to have_enqueued_job(DeliverPushNotificationJob)
      expect(partner.notifications.count).to eq(1) # still in the inbox
    end
  end
end

RSpec.describe "Logging care notifies the household", type: :request do
  include ActiveJob::TestHelper

  let(:household) { create(:household) }
  let(:actor)     { create(:user) }
  let(:cat)       { create(:cat, household: household, creator: actor) }

  before { create(:household_membership, household: household, user: actor, role: :admin, status: :active) }

  def auth_for(u)
    token, _payload = Warden::JWTAuth::UserEncoder.new.call(u, :user, nil)
    { "Authorization" => "Bearer #{token}" }
  end

  it "enqueues a notification job when a care event is created" do
    expect {
      post "/api/v1/households/#{household.id}/care_events",
           params: { care_event: { cat_id: cat.id, event_type: "feeding", occurred_at: Time.current.iso8601 } },
           headers: auth_for(actor), as: :json
    }.to have_enqueued_job(NotifyCareEventJob)
    expect(response).to have_http_status(:created)
  end

  it "does not notify when the event is rejected (free tier can't log weight)" do
    expect {
      post "/api/v1/households/#{household.id}/care_events",
           params: { care_event: { cat_id: cat.id, event_type: "weight", occurred_at: Time.current.iso8601 } },
           headers: auth_for(actor), as: :json
    }.not_to have_enqueued_job(NotifyCareEventJob)
    expect(response).to have_http_status(:forbidden)
  end
end
