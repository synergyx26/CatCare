FactoryBot.define do
  factory :household_invite do
    household { nil }
    email { "MyString" }
    token { "MyString" }
    status { 1 }
  end
end
