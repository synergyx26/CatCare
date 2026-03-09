FactoryBot.define do
  factory :reminder do
    cat { nil }
    household { nil }
    care_type { 1 }
    schedule_type { 1 }
  end
end
