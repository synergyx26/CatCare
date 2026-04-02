class ApplicationController < ActionController::API
  include Pundit::Authorization

  before_action :authenticate_user!

  rescue_from Pundit::NotAuthorizedError do
    render json: { error: "FORBIDDEN", message: "Not authorized" }, status: :forbidden
  end

  rescue_from ActiveRecord::RecordNotFound do
    render json: { error: "NOT_FOUND", message: "Resource not found" }, status: :not_found
  end

  private

  def super_admin?
    admin_email = ENV["SUPER_ADMIN_EMAIL"].to_s.strip
    admin_email.present? && current_user.email.casecmp?(admin_email)
  end
end
