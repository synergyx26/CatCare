FactoryBot.define do
  factory :household_chore_definition do
    household   { association(:household) }
    name        { "Litter boxes" }
    emoji       { "🧹" }
    active      { true }
    position    { 0 }
  end
end
