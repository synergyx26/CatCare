FactoryBot.define do
  factory :household_invite do
    household  { association(:household) }
    invited_by { association(:user) }
    email      { Faker::Internet.email }
    status     { :pending }
    role       { :member }
  end
end
