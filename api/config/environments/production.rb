require "active_support/core_ext/integer/time"

Rails.application.configure do
  # Settings specified here will take precedence over those in config/application.rb.

  # Code is not reloaded between requests.
  config.enable_reloading = false

  # Eager load code on boot for better performance and memory savings (ignored by Rake tasks).
  config.eager_load = true

  # Full error reports are disabled.
  config.consider_all_requests_local = false

  # Cache assets for far-future expiry since they are all digest stamped.
  config.public_file_server.headers = { "cache-control" => "public, max-age=#{1.year.to_i}" }

  # Enable serving of images, stylesheets, and JavaScripts from an asset server.
  # config.asset_host = "http://assets.example.com"

  # Supabase Storage via S3-compatible adapter. See config/storage.yml for env vars.
  config.active_storage.service = :supabase

  # Assume all access to the app is happening through a SSL-terminating reverse proxy.
  config.assume_ssl = true

  # Force all access to the app over SSL, use Strict-Transport-Security, and use secure cookies.
  config.force_ssl = true

  # Skip http-to-https redirect for the default health check endpoint.
  # config.ssl_options = { redirect: { exclude: ->(request) { request.path == "/up" } } }

  # Log to STDOUT with the current request id as a default log tag.
  config.log_tags = [ :request_id ]
  config.logger   = ActiveSupport::TaggedLogging.logger(STDOUT)

  # Change to "debug" to log everything (including potentially personally-identifiable information!).
  config.log_level = ENV.fetch("RAILS_LOG_LEVEL", "info")

  # Prevent health checks from clogging up the logs.
  config.silence_healthcheck_path = "/up"

  # Don't log any deprecations.
  config.active_support.report_deprecations = false

  # Use Redis as the cache store in production.
  config.cache_store = :redis_cache_store, { url: ENV.fetch("REDIS_URL") }

  # Use Sidekiq as the Active Job adapter.
  config.active_job.queue_adapter = :sidekiq

  # Set host to be used by links generated in mailer templates.
  config.action_mailer.default_url_options = { host: ENV.fetch("APP_HOST"), protocol: "https" }

  # Resend delivery — HTTPS API, no SMTP port restrictions.
  # Without the key the app boots normally but emails are silently discarded.
  if ENV["RESEND_API_KEY"].present?
    require "resend/mailer"
    Resend.api_key = ENV["RESEND_API_KEY"]
    config.action_mailer.raise_delivery_errors = true
    config.action_mailer.delivery_method = :resend
  else
    config.action_mailer.delivery_method = :test
  end

  # Enable locale fallbacks for I18n (makes lookups for any locale fall back to
  # the I18n.default_locale when a translation cannot be found).
  config.i18n.fallbacks = true

  # Do not dump schema after migrations.
  config.active_record.dump_schema_after_migration = false

  # Only use :id for inspections in production.
  config.active_record.attributes_for_inspect = [ :id ]

  # Enable DNS rebinding protection. Allow the Render-assigned host.
  config.hosts << ENV.fetch("APP_HOST")
  config.host_authorization = { exclude: ->(request) { ["/up", "/health"].include?(request.path) } }
end
