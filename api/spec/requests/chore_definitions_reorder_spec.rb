require "rails_helper"

RSpec.describe "Chore definition reorder", type: :request do
  let(:household) { create(:household) }
  let(:admin)     { create(:user) }
  let(:sitter)    { create(:user) }
  let(:base)      { "/api/v1/households/#{household.id}/chore_definitions" }
  let!(:a) { create(:household_chore_definition, household: household, name: "A", position: 0) }
  let!(:b) { create(:household_chore_definition, household: household, name: "B", position: 1) }
  let!(:c) { create(:household_chore_definition, household: household, name: "C", position: 2) }

  before do
    household.household_chore_definitions.where.not(id: [a.id, b.id, c.id]).destroy_all
    create(:household_membership, user: admin,  household: household, role: :admin,  status: :active)
    create(:household_membership, user: sitter, household: household, role: :sitter, status: :active)
  end

  def auth_for(user)
    token, _payload = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
    { "Authorization" => "Bearer #{token}" }
  end

  it "persists the new order and returns it" do
    patch "#{base}/reorder", params: { ids: [c.id, a.id, b.id] }, headers: auth_for(admin)

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["data"].map { |d| d["name"] }).to eq(%w[C A B])
    expect(household.household_chore_definitions.ordered.pluck(:name)).to eq(%w[C A B])
  end

  it "rejects a partial or foreign id list and changes nothing" do
    other = create(:household_chore_definition, household: create(:household))
    patch "#{base}/reorder", params: { ids: [a.id, other.id, b.id] }, headers: auth_for(admin)

    expect(response).to have_http_status(:unprocessable_content)
    expect(household.household_chore_definitions.ordered.pluck(:name)).to eq(%w[A B C])
  end

  it "forbids sitters" do
    patch "#{base}/reorder", params: { ids: [c.id, b.id, a.id] }, headers: auth_for(sitter)

    expect(response).to have_http_status(:forbidden)
    expect(household.household_chore_definitions.ordered.pluck(:name)).to eq(%w[A B C])
  end

  it "appends new chores after the current last position" do
    post base, params: { household_chore_definition: { name: "D" } }, headers: auth_for(admin)

    expect(household.household_chore_definitions.ordered.pluck(:name)).to eq(%w[A B C D])
  end
end
