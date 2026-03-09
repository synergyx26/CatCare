FactoryBot.define do
  factory :household_membership do
    household { nil }
    user { nil }
    role { 1 }
    status { 1 }
  end
end
