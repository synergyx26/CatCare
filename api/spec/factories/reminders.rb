FactoryBot.define do
  factory :reminder do
    cat           { association(:cat) }
    household     { cat.household }
    created_by    { association(:user) }
    care_type     { :feeding }
    schedule_type { :daily }
    schedule_value { '08:00' }
    active        { true }
  end
end
