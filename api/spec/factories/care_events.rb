FactoryBot.define do
  factory :care_event do
    cat { nil }
    household { nil }
    event_type { 1 }
    occurred_at { "2026-03-09 22:30:45" }
  end
end
