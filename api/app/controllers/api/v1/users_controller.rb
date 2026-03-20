module Api
  module V1
    class UsersController < BaseController
      # GET /api/v1/me — return the currently authenticated user
      def me
        render json: {
          data: {
            id: current_user.id,
            email: current_user.email,
            name: current_user.name,
            created_at: current_user.created_at
          }
        }
      end
    end
  end
end
