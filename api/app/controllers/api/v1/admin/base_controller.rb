module Api
  module V1
    module Admin
      class BaseController < ApplicationController
        before_action :require_super_admin!

        private

        def require_super_admin!
          unless super_admin?
            render json: { error: "FORBIDDEN", message: "Not authorized" }, status: :forbidden
          end
        end
      end
    end
  end
end
