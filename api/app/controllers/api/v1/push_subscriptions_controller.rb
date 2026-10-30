module Api
  module V1
    class PushSubscriptionsController < BaseController
      # GET /api/v1/push_subscriptions/vapid_key — public VAPID key for the browser
      def vapid_key
        authorize PushSubscription, :create?
        return render_error("PUSH_NOT_CONFIGURED", "Push is not configured on this server", status: :service_unavailable) unless Notifications::WebPushSender.configured?

        render_success({ public_key: Notifications::WebPushSender.public_key,
                         device_count: policy_scope(PushSubscription).count })
      end

      # POST /api/v1/push_subscriptions  { subscription: { endpoint, keys: { p256dh, auth } } }
      def create
        authorize PushSubscription
        sub_params = params.require(:subscription).permit(:endpoint, keys: [:p256dh, :auth])
        keys = sub_params[:keys] || {}

        # Same device re-subscribing (or a different user on a shared browser)
        # must not leave a stale row behind: endpoint is globally unique.
        subscription = PushSubscription.find_or_initialize_by(endpoint: sub_params[:endpoint])
        subscription.assign_attributes(
          user: current_user, p256dh: keys[:p256dh], auth: keys[:auth],
          user_agent: request.user_agent.to_s.truncate(255)
        )
        subscription.save!

        # Registering a device is an explicit opt-in to push.
        prefs = current_user.notification_preferences.deep_dup
        prefs["push"] = (prefs["push"] || {}).merge("enabled" => true)
        current_user.update!(notification_preferences: prefs)

        render_success({ id: subscription.id }, status: :created)
      rescue ActiveRecord::RecordInvalid => e
        render_error("VALIDATION_ERROR", e.message, status: :unprocessable_entity)
      end

      # DELETE /api/v1/push_subscriptions  { endpoint }
      def destroy
        subscription = policy_scope(PushSubscription).find_by!(endpoint: params.require(:endpoint))
        authorize subscription
        subscription.destroy!
        head :no_content
      end

      # POST /api/v1/push_subscriptions/test — sends a notification to all of the caller's devices
      def test
        authorize PushSubscription
        Notifications::Notifier.call(
          current_user, kind: "system.test", title: "CatCare test notification",
          body: "If you can read this, push notifications work on this device.", url: "/notifications"
        )
        render_success({ devices: policy_scope(PushSubscription).count })
      end
    end
  end
end
