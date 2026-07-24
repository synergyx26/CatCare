namespace :catcare do
  namespace :local do
    desc "Reset all non-OAuth users to a shared local password after restoring the cloud DB dump. " \
         "Usage: LOCAL_PASSWORD=yourpassword bundle exec rails catcare:local:reset_credentials"
    task reset_credentials: :environment do
      abort "Refusing to run against production data (RAILS_ENV=production)." if Rails.env.production?

      password = ENV["LOCAL_PASSWORD"]
      abort "Set LOCAL_PASSWORD, e.g. LOCAL_PASSWORD=changeme123 bundle exec rails catcare:local:reset_credentials" if password.blank?
      abort "LOCAL_PASSWORD must be at least 6 characters (Devise minimum)." if password.length < 6

      users = User.where(provider: nil)
      abort "No local (non-OAuth) users found." if users.none?

      users.find_each do |user|
        user.password = password
        user.password_confirmation = password
        user.failed_attempts = 0
        user.locked_at = nil
        user.unlock_token = nil
        user.reset_password_token = nil
        user.reset_password_sent_at = nil
        user.save!(validate: false)
      end

      puts "Reset password for #{users.count} user(s) to LOCAL_PASSWORD:"
      users.pluck(:email).each { |email| puts "  #{email}" }

      oauth_count = User.where.not(provider: nil).count
      puts "Skipped #{oauth_count} Google OAuth account(s) — sign in with Google unaffected." if oauth_count.positive?
    end
  end
end
