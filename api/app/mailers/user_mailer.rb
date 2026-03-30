class UserMailer < ApplicationMailer
  # Sends a password reset link to the user.
  # The link points to the React frontend reset page with the raw token.
  def reset_password_instructions(user, token)
    @user      = user
    @reset_url = "#{ENV.fetch('FRONTEND_URL', 'http://localhost:5173')}/reset-password/#{token}"

    mail(to: user.email, subject: "Reset your CatCare password")
  end

  # Sends a household invite link to the invitee's email address.
  def invite(invite)
    @invited_by     = invite.invited_by.name
    @household_name = invite.household.name
    @role           = invite.role
    @invite_url     = "#{ENV.fetch('FRONTEND_URL', 'http://localhost:5173')}/invite/#{invite.token}"

    mail(to: invite.email, subject: "#{@invited_by} invited you to #{@household_name} on CatCare")
  end

  # Sends a care reminder email to a household member.
  # `cat` is explicit so all_cats reminders can send one email per cat.
  def reminder_notification(reminder, user, cat = nil)
    @reminder      = reminder
    @user          = user
    @cat           = cat || reminder.cat
    @household     = reminder.household
    @dashboard_url = "#{ENV.fetch('FRONTEND_URL', 'http://localhost:5173')}/dashboard"
    @settings_url  = "#{ENV.fetch('FRONTEND_URL', 'http://localhost:5173')}/notification-settings"

    mail(
      to:      user.email,
      subject: "[CatCare] #{@cat.name} \u2013 #{reminder.care_type.humanize} reminder"
    )
  end
end
