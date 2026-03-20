FactoryBot.define do
  factory :household do
    name    { "#{Faker::Address.city} Household" }
    creator { association(:user) }
  end
end
