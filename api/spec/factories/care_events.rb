FactoryBot.define do
  factory :care_event do
    cat        { association(:cat) }
    logged_by  { association(:user) }
    household  { cat.household }
    event_type { :feeding }
    occurred_at { Time.current }
  end
end
