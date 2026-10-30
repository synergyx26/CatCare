FactoryBot.define do
  factory :notification do
    user
    kind  { "test.event" }
    title { "Hello" }
    body  { "Something happened" }
  end

  factory :push_subscription do
    user
    sequence(:endpoint) { |n| "https://push.example.com/send/#{n}" }
    p256dh { "BPubKey" }
    auth   { "authsecret" }
  end

  factory :backup_export do
    kind   { "csv" }
    status { "ok" }
  end
end
