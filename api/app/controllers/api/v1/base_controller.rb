module Api
  module V1
    class BaseController < ApplicationController
      private

      def render_success(data, status: :ok, meta: {})
        render json: { data: data, meta: meta }, status: status
      end

      def render_error(code, message, status:)
        render json: { error: code, message: message }, status: status
      end

      def current_household
        @current_household ||= current_user.households.find(params[:household_id])
      end
    end
  end
end
