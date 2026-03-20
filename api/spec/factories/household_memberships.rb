FactoryBot.define do
  factory :household_membership do
    household { association(:household) }
    user      { association(:user) }
    role      { :admin }
    status    { :active }
  end
end
