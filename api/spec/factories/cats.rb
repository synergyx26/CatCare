FactoryBot.define do
  factory :cat do
    household { association(:household) }
    creator   { association(:user) }
    name      { Faker::Creature::Cat.name }
    species   { :cat }
    sex       { :unknown }
    active    { true }
  end
end
