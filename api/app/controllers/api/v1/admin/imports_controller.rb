module Api
  module V1
    module Admin
      class ImportsController < BaseController
        private

        def current_household
          @current_household ||= current_user.households.first
        end

        public

        def care_events
          events = params.require(:events)
          failed = []
          to_insert = []
          now = Time.current
          event_type_map = CareEvent.event_types # {"feeding"=>0, "litter"=>1, ...}

          events.each_with_index do |row, i|
            cat = current_household.cats.find_by(id: row[:cat_id])
            unless cat
              failed << { row: i + 1, error: "Cat not found" }
              next
            end

            event_type_int = event_type_map[row[:event_type].to_s]
            unless event_type_int
              failed << { row: i + 1, error: "Unknown event type: #{row[:event_type]}" }
              next
            end

            occurred_at = begin
              Time.parse(row[:occurred_at].to_s).utc
            rescue ArgumentError, TypeError
              nil
            end

            unless occurred_at
              failed << { row: i + 1, error: "Invalid occurred_at: #{row[:occurred_at]}" }
              next
            end

            details = row[:details].present? ? row[:details].to_unsafe_h : {}

            # Medication events imported via this tool are historical dose logs.
            # Mark them so MedicationsSection excludes them from the active/stopped
            # display — they appear only in the care event timeline.
            if event_type_int == event_type_map["medication"]
              details = details.merge("historical" => true, "stopped" => true)
            end

            to_insert << {
              cat_id:        cat.id,
              household_id:  current_household.id,
              logged_by_id:  current_user.id,
              event_type:    event_type_int,
              occurred_at:   occurred_at,
              notes:         row[:notes].presence,
              details:       details,
              created_at:    now,
              updated_at:    now,
            }
          end

          imported = 0
          if to_insert.any?
            result = CareEvent.insert_all(to_insert)
            imported = result.length
          end

          render json: { imported: imported, failed: failed }
        end
      end
    end
  end
end
