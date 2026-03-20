class ApplicationMailer < ActionMailer::Base
  default from: ENV.fetch("MAILER_SENDER", "noreply@catcare.app")
  layout "mailer"
end
