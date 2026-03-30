Sidekiq.configure_server do |config|
  config.on(:startup) do
    Sidekiq::Cron::Job.load_from_hash(
      "process_pending_reminders" => {
        "class"       => "ProcessPendingRemindersJob",
        "cron"        => "*/5 * * * *",
        "queue"       => "reminders",
        "description" => "Fire email notifications for due reminders"
      }
    )
  end
end
