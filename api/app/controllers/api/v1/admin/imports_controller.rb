module Api
  module V1
    module Admin
      class ImportsController < BaseController
        def care_events
          events = params.require(:events)
          imported = 0
          failed = []

          events.each_with_index do |row, i|
            cat = current_household.cats.find_by(id: row[:cat_id])
            unless cat
              failed << { row: i + 1, error: "Cat not found" }
              next
            end

            event = CareEvent.new(
              cat: cat,
              household: current_household,
              logged_by_id: current_user.id,
              event_type: row[:event_type],
              occurred_at: row[:occurred_at],
              notes: row[:notes].presence,
              details: row[:details].present? ? row[:details].to_unsafe_h : {}
            )

            if event.save
              imported += 1
            else
              failed << { row: i + 1, error: event.errors.full_messages.join(", ") }
            end
          end

          render json: { imported: imported, failed: failed }
        end
      end
    end
  end
end
