class UserMailer < ApplicationMailer
  # Sends a password reset link to the user.
  # The link points to the React frontend reset page with the raw token.
  def reset_password_instructions(user, token)
    @user      = user
    @reset_url = "#{ENV.fetch('FRONTEND_URL', 'http://localhost:5173')}/reset-password/#{token}"

    mail(to: user.email, subject: "Reset your CatCare password")
  end
end
