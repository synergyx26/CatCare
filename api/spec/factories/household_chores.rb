FactoryBot.define do
  factory :household_chore do
    household   { association(:household) }
    logged_by   { association(:user) }
    chore_type  { :litter }
    occurred_at { Time.current }
  end
end
