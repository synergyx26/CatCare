require "rails_helper"

RSpec.describe "Cat appearance", type: :request do
  let(:household) { create(:household) }
  let(:admin)     { create(:user) }
  let(:cat)       { create(:cat, household: household, creator: admin, name: "Whiskey") }
  let(:base)      { "/api/v1/households/#{household.id}/cats/#{cat.id}" }

  before { create(:household_membership, user: admin, household: household, role: :admin, status: :active) }

  def auth_for(user)
    token, _payload = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
    { "Authorization" => "Bearer #{token}" }
  end

  def attach_photo
    cat.photo.attach(io: StringIO.new("fake image bytes"), filename: "whiskey.jpg", content_type: "image/jpeg")
  end

  describe "GET appearance_suggestion" do
    let(:suggestion) { { "pattern" => "tuxedo", "fur" => "#2f3036", "fur2" => "#f5f3ee", "eyes" => "#f2c94c" } }

    it "returns the suggestion for the cat's photo" do
      attach_photo
      allow(CatAppearance::PhotoSampler).to receive(:from_blob).and_return({ center: [[0, 0, 0]], border: [] })
      allow(CatAppearance::Suggester).to receive(:new).and_return(instance_double(CatAppearance::Suggester, call: suggestion))

      get "#{base}/appearance_suggestion", headers: auth_for(admin)

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["data"]).to eq(suggestion)
      expect(cat.reload.appearance).to be_nil # suggesting never saves
    end

    it "explains when there's no photo" do
      get "#{base}/appearance_suggestion", headers: auth_for(admin)

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["error"]).to eq("NO_PHOTO")
    end

    it "explains when the photo can't be read" do
      attach_photo
      allow(CatAppearance::PhotoSampler).to receive(:from_blob)
        .and_raise(CatAppearance::PhotoSampler::UnreadableImage, "bad header")

      get "#{base}/appearance_suggestion", headers: auth_for(admin)

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["error"]).to eq("PHOTO_UNREADABLE")
    end

    it "is forbidden for sitters" do
      sitter = create(:user)
      create(:household_membership, user: sitter, household: household, role: :sitter, status: :active)

      get "#{base}/appearance_suggestion", headers: auth_for(sitter)

      expect(response).to have_http_status(:forbidden)
    end

    it "requires authentication" do
      get "#{base}/appearance_suggestion"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "PATCH appearance" do
    let(:look) { { pattern: "calico", fur: "#F5F3EE", fur2: "#f0a050", fur3: "#2f3036", eyes: "#c98a2b" } }

    it "saves a look and returns it on the cat" do
      patch base, params: { cat: { appearance: look } }, headers: auth_for(admin), as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig("data", "appearance")).to include("pattern" => "calico", "fur" => "#f5f3ee")
      expect(cat.reload.appearance["fur3"]).to eq("#2f3036")
    end

    it "drops keys that aren't part of the look" do
      patch base, params: { cat: { appearance: look.merge(wings: "#ffffff") } }, headers: auth_for(admin), as: :json

      expect(response).to have_http_status(:ok)
      expect(cat.reload.appearance).not_to have_key("wings")
    end

    it "clears the look with null" do
      cat.update!(appearance: look.stringify_keys)

      patch base, params: { cat: { appearance: nil } }, headers: auth_for(admin), as: :json

      expect(response).to have_http_status(:ok)
      expect(cat.reload.appearance).to be_nil
    end

    it "rejects an invalid look with a 422" do
      patch base, params: { cat: { appearance: look.merge(pattern: "plaid") } }, headers: auth_for(admin), as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["message"]).to include("pattern")
    end

    it "rejects a non-object look with a 422" do
      patch base, params: { cat: { appearance: "tabby" } }, headers: auth_for(admin), as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end
  end
end
