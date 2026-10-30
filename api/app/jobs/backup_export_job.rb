# Nightly in-app database export. Always tells every super admin how it went
# (success or failure) so a missing backup is never silent.
class BackupExportJob < ApplicationJob
  queue_as :default

  def perform(requested_by_id = nil)
    requester = User.find_by(id: requested_by_id)
    export = Backups::CsvExporter.call(requested_by: requester)
    BackupExport.prune!

    rows = export.table_counts.values.sum
    notify_admins(
      kind: "backup.ready", title: "Database backup ready",
      body: "#{export.table_counts.size} tables, #{rows} rows, #{ActiveSupport::NumberHelper.number_to_human_size(export.byte_size)}. Tap to download.",
      url: "/admin/backups", data: { backup_export_id: export.id }
    )
  rescue StandardError => e
    Sentry.capture_exception(e) if defined?(Sentry)
    notify_admins(
      kind: "backup.failed", title: "Database backup FAILED",
      body: e.message.truncate(200), url: "/admin/backups"
    )
    # Deliberately not re-raised: Sidekiq would retry and re-notify every
    # time. The failure is on the BackupExport row, in Sentry and in the inbox.
  end

  private

  def notify_admins(**attrs)
    User.super_admins.find_each do |admin|
      Notifications::Notifier.call(admin, **attrs)
    end
  end
end
