module Api
  module V1
    module Admin
      class StatsController < BaseController
        # GET /api/v1/admin/stats
        def show
          tier_breakdown = User.group(:subscription_tier).count

          # Signups per day for the last 30 days
          thirty_days_ago = 30.days.ago.beginning_of_day
          signups_by_day  = User
            .where("created_at >= ?", thirty_days_ago)
            .group("DATE(created_at)")
            .order("DATE(created_at)")
            .count
            .map { |date, count| { date: date.to_s, count: count } }

          render json: {
            data: {
              total_users:       User.count,
              total_households:  Household.count,
              total_cats:        Cat.count,
              total_care_events: CareEvent.count,
              tier_breakdown:    {
                free:    tier_breakdown["free"]    || 0,
                pro:     tier_breakdown["pro"]     || 0,
                premium: tier_breakdown["premium"] || 0
              },
              signups_by_day: signups_by_day
            }
          }
        end
      end
    end
  end
end
