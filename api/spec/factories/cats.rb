FactoryBot.define do
  factory :cat do
    household { nil }
    name { "MyString" }
    species { 1 }
    sex { 1 }
  end
end
