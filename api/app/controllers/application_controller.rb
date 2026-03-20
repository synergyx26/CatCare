class ApplicationController < ActionController::API
  include Pundit::Authorization

  before_action :authenticate_user!

  rescue_from Pundit::NotAuthorizedError do
    render json: { error: "FORBIDDEN", message: "Not authorized" }, status: :forbidden
  end

  rescue_from ActiveRecord::RecordNotFound do
    render json: { error: "NOT_FOUND", message: "Resource not found" }, status: :not_found
  end
end
