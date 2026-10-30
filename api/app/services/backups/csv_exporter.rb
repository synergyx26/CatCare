require "csv"
require "digest"
require "zip"

module Backups
  # Dumps every table to CSV, zips the result and stores it on a BackupExport
  # (Active Storage). Shared by the nightly job, the "Back up now" button and
  # the catcare:backup:export_csv rake task.
  class CsvExporter
    EXCLUDED_TABLES = %w[schema_migrations ar_internal_metadata].freeze

    def self.call(requested_by: nil)
      new(requested_by).call
    end

    def initialize(requested_by)
      @export = BackupExport.create!(kind: "csv", status: "pending", requested_by: requested_by)
    end

    def call
      zip_data, counts = build_zip
      @export.file.attach(io: StringIO.new(zip_data), filename: @export.filename, content_type: "application/zip")
      @export.update!(
        status: "ok", byte_size: zip_data.bytesize, table_counts: counts,
        checksum_sha256: Digest::SHA256.hexdigest(zip_data)
      )
      @export
    rescue StandardError => e
      @export.update(status: "failed", error: "#{e.class}: #{e.message}".truncate(1000))
      raise
    end

    private

    def build_zip
      conn   = ActiveRecord::Base.connection
      tables = conn.tables.sort - EXCLUDED_TABLES
      counts = {}

      buffer = Zip::OutputStream.write_buffer do |zip|
        tables.each do |table|
          columns = conn.columns(table).map(&:name)
          count   = 0
          zip.put_next_entry("#{table}.csv")
          zip.write(CSV.generate do |csv|
            csv << columns
            conn.select_all(%(SELECT * FROM #{conn.quote_table_name(table)})).each do |row|
              csv << columns.map { |c| v = row[c]; v.is_a?(Hash) || v.is_a?(Array) ? v.to_json : v }
              count += 1
            end
          end)
          counts[table] = count
        end
      end

      [buffer.string, counts]
    end
  end
end
