module Api
  module V1
    class NotificationsController < BaseController
      # GET /api/v1/notifications?limit=50
      def index
        authorize Notification
        scope = policy_scope(Notification)
        limit = params.fetch(:limit, 50).to_i.clamp(1, 100)
        render_success(
          scope.recent.limit(limit).map { |n| serialize(n) },
          meta: { total: scope.count, unread: scope.unread.count }
        )
      end

      # PATCH /api/v1/notifications/:id/read
      def read
        notification = policy_scope(Notification).find(params[:id])
        authorize notification, :update?
        notification.update!(read_at: Time.current) unless notification.read?
        render_success(serialize(notification))
      end

      # POST /api/v1/notifications/read_all
      def read_all
        authorize Notification, :read_all?
        policy_scope(Notification).unread.update_all(read_at: Time.current)
        render_success({})
      end

      # DELETE /api/v1/notifications/:id
      def destroy
        notification = policy_scope(Notification).find(params[:id])
        authorize notification
        notification.destroy!
        head :no_content
      end

      private

      def serialize(n)
        { id: n.id, kind: n.kind, title: n.title, body: n.body, url: n.url,
          data: n.data, read: n.read?, created_at: n.created_at.utc.iso8601 }
      end
    end
  end
end
