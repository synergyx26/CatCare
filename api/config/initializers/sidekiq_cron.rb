Sidekiq.configure_server do |config|
  config.on(:startup) do
    Sidekiq::Cron::Job.load_from_hash(
      "process_pending_reminders" => {
        "class"       => "ProcessPendingRemindersJob",
        "cron"        => "*/5 * * * *",
        "queue"       => "reminders",
        "description" => "Fire email notifications for due reminders"
      },
      "nightly_backup_export" => {
        "class"       => "BackupExportJob",
        "cron"        => "0 3 * * *",
        "queue"       => "default",
        "description" => "Export every table to a zip of CSVs kept in the app and notify super admins"
      }
    )
  end
end
