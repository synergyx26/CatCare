require "rails_helper"

RSpec.describe "Notifications, push subscriptions and backups", type: :request do
  include ActiveJob::TestHelper

  let(:user)  { create(:user) }
  let(:other) { create(:user) }
  let(:admin) { create(:user, email: "boss@example.com") }

  def auth_for(u)
    token, _payload = Warden::JWTAuth::UserEncoder.new.call(u, :user, nil)
    { "Authorization" => "Bearer #{token}" }
  end

  before { stub_const("ENV", ENV.to_h.merge("SUPER_ADMIN_EMAIL" => "boss@example.com")) }

  describe "inbox" do
    it "requires authentication" do
      get "/api/v1/notifications"
      expect(response).to have_http_status(:unauthorized)
    end

    it "lists only my notifications with an unread count" do
      create(:notification, user: user)
      create(:notification, user: user, read_at: Time.current)
      create(:notification, user: other)
      get "/api/v1/notifications", headers: auth_for(user)
      expect(response.parsed_body["data"].size).to eq(2)
      expect(response.parsed_body["meta"]).to include("unread" => 1, "total" => 2)
    end

    it "marks one read, and cannot touch another user's" do
      mine = create(:notification, user: user)
      theirs = create(:notification, user: other)
      patch "/api/v1/notifications/#{mine.id}/read", headers: auth_for(user)
      expect(mine.reload).to be_read
      patch "/api/v1/notifications/#{theirs.id}/read", headers: auth_for(user)
      expect(response).to have_http_status(:not_found)
      expect(theirs.reload).not_to be_read
    end

    it "marks all read" do
      create_list(:notification, 3, user: user)
      post "/api/v1/notifications/read_all", headers: auth_for(user)
      expect(user.notifications.unread.count).to eq(0)
    end
  end

  describe "push subscriptions" do
    let(:payload) { { subscription: { endpoint: "https://push.example.com/abc", keys: { p256dh: "k", auth: "a" } } } }

    it "registers a device and opts the user in to push" do
      post "/api/v1/push_subscriptions", params: payload, headers: auth_for(user), as: :json
      expect(response).to have_http_status(:created)
      expect(user.push_subscriptions.count).to eq(1)
      expect(user.reload.notification_preferences.dig("push", "enabled")).to be(true)
    end

    it "re-assigns an existing endpoint instead of duplicating it" do
      create(:push_subscription, user: other, endpoint: "https://push.example.com/abc")
      post "/api/v1/push_subscriptions", params: payload, headers: auth_for(user), as: :json
      expect(PushSubscription.where(endpoint: "https://push.example.com/abc").count).to eq(1)
      expect(PushSubscription.find_by(endpoint: "https://push.example.com/abc").user).to eq(user)
    end

    it "rejects non-https endpoints" do
      bad = { subscription: { endpoint: "http://10.0.0.1/x", keys: { p256dh: "k", auth: "a" } } }
      post "/api/v1/push_subscriptions", params: bad, headers: auth_for(user), as: :json
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "only deletes my own device" do
      theirs = create(:push_subscription, user: other)
      delete "/api/v1/push_subscriptions", params: { endpoint: theirs.endpoint }, headers: auth_for(user), as: :json
      expect(response).to have_http_status(:not_found)
      expect(PushSubscription.exists?(theirs.id)).to be(true)
    end

    it "reports when push is not configured" do
      stub_const("ENV", ENV.to_h.except("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"))
      get "/api/v1/push_subscriptions/vapid_key", headers: auth_for(user)
      expect(response).to have_http_status(:service_unavailable)
    end

    it "test endpoint adds an inbox item" do
      expect {
        post "/api/v1/push_subscriptions/test", headers: auth_for(user)
      }.to change { user.notifications.where(kind: "system.test").count }.by(1)
    end
  end

  describe "admin backups" do
    it "forbids non-admins" do
      get "/api/v1/admin/backups", headers: auth_for(user)
      expect(response).to have_http_status(:forbidden)
      post "/api/v1/admin/backups", headers: auth_for(user)
      expect(response).to have_http_status(:forbidden)
    end

    it "queues an export for admins" do
      expect { post "/api/v1/admin/backups", headers: auth_for(admin) }.to have_enqueued_job(BackupExportJob)
      expect(response).to have_http_status(:accepted)
    end

    it "lists and downloads an export" do
      export = Backups::CsvExporter.call(requested_by: admin)
      get "/api/v1/admin/backups", headers: auth_for(admin)
      expect(response.parsed_body["data"].first["id"]).to eq(export.id)
      get "/api/v1/admin/backups/#{export.id}/download", headers: auth_for(admin)
      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("application/zip")
      expect(response.body.bytesize).to eq(export.byte_size)
    end
  end
end
