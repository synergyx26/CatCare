FactoryBot.define do
  factory :vacation_trip do
    association :household
    creator { association(:user) }
    start_date { Date.today }
    end_date   { 7.days.from_now.to_date }
    sitter_visit_frequency_days { 2 }
    notes { nil }
  end
end
