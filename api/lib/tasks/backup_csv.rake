namespace :catcare do
  namespace :backup do
    desc "Export every table to CSV under db/backups/csv/<timestamp>/ (or DIR=... to override). " \
         "Usage: bundle exec rails catcare:backup:export_csv"
    task export_csv: :environment do
      require "csv"

      timestamp = Time.current.utc.strftime("%Y%m%dT%H%M%SZ")
      base_dir  = ENV["DIR"].presence || Rails.root.join("db", "backups", "csv").to_s
      out_dir   = File.join(base_dir, timestamp)
      FileUtils.mkdir_p(out_dir)

      conn   = ActiveRecord::Base.connection
      tables = conn.tables.sort - %w[schema_migrations ar_internal_metadata]

      tables.each do |table|
        columns   = conn.columns(table).map(&:name)
        path      = File.join(out_dir, "#{table}.csv")
        row_count = 0

        CSV.open(path, "w") do |csv|
          csv << columns
          conn.select_all(%(SELECT * FROM "#{table}")).each do |row|
            csv << columns.map do |c|
              value = row[c]
              # jsonb columns deserialize to Hash/Array — write as JSON text
              # rather than Ruby's Hash#to_s so the CSV cell stays valid,
              # re-parseable data.
              value.is_a?(Hash) || value.is_a?(Array) ? value.to_json : value
            end
            row_count += 1
          end
        end

        puts "  #{table}: #{row_count} row(s) -> #{path}"
      end

      puts "CSV backup complete: #{out_dir}"
    end

    desc "Delete CSV backup directories older than KEEP_DAYS (default 30). " \
         "Usage: bundle exec rails catcare:backup:prune_csv"
    task prune_csv: :environment do
      base_dir  = ENV["DIR"].presence || Rails.root.join("db", "backups", "csv").to_s
      keep_days = (ENV["KEEP_DAYS"].presence || 30).to_i
      cutoff    = keep_days.days.ago

      Dir.glob(File.join(base_dir, "*")).each do |dir|
        next unless File.directory?(dir)
        next if File.mtime(dir) >= cutoff

        FileUtils.rm_rf(dir)
        puts "  pruned #{dir}"
      end
    end
  end
end
