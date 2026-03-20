Sentry.init do |config|
  config.dsn = ENV["SENTRY_DSN"]

  # Capture 10% of transactions for performance monitoring
  config.traces_sample_rate = 0.1

  # Don't report errors in development/test unless DSN is explicitly set
  config.enabled_environments = %w[production staging]
end
