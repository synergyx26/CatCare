module Api
  module V1
    class VacationTripsController < BaseController
      # GET /api/v1/households/:household_id/vacation_trips
      def index
        authorize current_household, policy_class: VacationTripPolicy
        trips = current_household.vacation_trips.order(start_date: :desc)
        render_success(trips.map { |t| serialize(t) })
      end

      # POST /api/v1/households/:household_id/vacation_trips
      def create
        trip = current_household.vacation_trips.build(trip_params)
        trip.created_by_id = current_user.id
        authorize trip
        if trip.save
          render_success(serialize(trip), status: :created)
        else
          render_error("VALIDATION_ERROR", trip.errors.full_messages.join(", "),
                       status: :unprocessable_entity)
        end
      end

      # PATCH /api/v1/households/:household_id/vacation_trips/:id
      def update
        trip = current_household.vacation_trips.find(params[:id])
        authorize trip
        if trip.update(trip_params)
          render_success(serialize(trip))
        else
          render_error("VALIDATION_ERROR", trip.errors.full_messages.join(", "),
                       status: :unprocessable_entity)
        end
      end

      # DELETE /api/v1/households/:household_id/vacation_trips/:id
      def destroy
        trip = current_household.vacation_trips.find(params[:id])
        authorize trip
        trip.destroy
        head :no_content
      end

      private

      def trip_params
        params.require(:vacation_trip).permit(
          :start_date, :end_date, :notes, :sitter_visit_frequency_days, :active
        )
      end

      def serialize(trip)
        {
          id:                          trip.id,
          household_id:                trip.household_id,
          created_by_id:               trip.created_by_id,
          start_date:                  trip.start_date,
          end_date:                    trip.end_date,
          notes:                       trip.notes,
          sitter_visit_frequency_days: trip.sitter_visit_frequency_days,
          active:                      trip.active?,
          created_at:                  trip.created_at,
          updated_at:                  trip.updated_at,
        }
      end
    end
  end
end
