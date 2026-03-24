module Api
  module V1
    class CatsController < BaseController
      before_action :set_cat, only: [:show, :update, :stats]

      # GET /api/v1/households/:household_id/cats
      # ?include_inactive=true returns archived/deceased cats (non-sitters only)
      def index
        authorize current_household, policy_class: CatPolicy
        if params[:include_inactive].present? && authorize(current_household, :archive?, policy_class: CatPolicy)
          cats = current_household.cats.with_attached_photo.where(active: false)
        else
          cats = current_household.cats.with_attached_photo.active
        end
        render json: { data: cats.map { |c| cat_json(c) } }
      end

      # GET /api/v1/households/:household_id/cats/:id
      def show
        authorize @cat
        render json: { data: cat_json(@cat) }
      end

      # POST /api/v1/households/:household_id/cats
      def create
        authorize current_household.cats.build, policy_class: CatPolicy
        cat = current_household.cats.build(cat_params)
        cat.created_by_id = current_user.id
        cat.active = true

        if cat.save
          render json: { data: cat_json(cat) }, status: :created
        else
          render json: {
            error: "CREATE_FAILED",
            message: cat.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/households/:household_id/cats/:id
      def update
        authorize @cat
        if @cat.update(cat_params)
          render json: { data: cat_json(@cat) }
        else
          render json: {
            error: "UPDATE_FAILED",
            message: @cat.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/households/:household_id/cats/:id/stats
      def stats
        authorize @cat
        range = params[:range] || "30d"
        days  = case range
                when "7d"  then 7
                when "90d" then 90
                else 30
                end

        start_time = days.days.ago.beginning_of_day
        end_time   = Time.current.end_of_day
        events     = @cat.care_events.where(occurred_at: start_time..end_time).to_a

        render_success({
          range:         range,
          start_date:    start_time.iso8601,
          end_date:      end_time.iso8601,
          total_events:  events.count,
          by_type:       events_by_type(events),
          by_day:        events_by_day(events, start_time, days),
          weight_series: weight_series(events),
          by_member:     events_by_member(events),
        })
      end

      private

      # Returns a URL only when the blob is stored in the currently configured service.
      # Blobs recorded against an old service (e.g. "local" before the Supabase migration)
      # are skipped rather than serving a broken URL — the frontend falls back to the
      # avatar placeholder and the user can re-upload.
      def photo_url_for(cat)
        return nil unless cat.photo.attached?
        current_service = Rails.application.config.active_storage.service.to_s
        return nil unless cat.photo.blob.service_name == current_service
        url_for(cat.photo)
      end

      def set_cat
        @cat = current_household.cats.with_attached_photo.find(params[:id])
      end

      def cat_params
        params.require(:cat).permit(
          :name, :species, :sex, :sterilized,
          :birthday, :breed, :microchip_number, :health_notes, :active, :deceased, :photo,
          :vet_name, :vet_clinic, :vet_phone, :care_instructions
        )
      end

      def cat_json(cat)
        {
          id:                cat.id,
          household_id:      cat.household_id,
          name:              cat.name,
          species:           cat.species,
          sex:               cat.sex,
          sterilized:        cat.sterilized,
          birthday:          cat.birthday,
          breed:             cat.breed,
          microchip_number:  cat.microchip_number,
          health_notes:      cat.health_notes,
          active:            cat.active,
          deceased:          cat.deceased,
          created_by:        cat.created_by_id,
          photo_url:         photo_url_for(cat),
          vet_name:          cat.vet_name,
          vet_clinic:        cat.vet_clinic,
          vet_phone:         cat.vet_phone,
          care_instructions: cat.care_instructions,
          created_at:        cat.created_at,
          updated_at:        cat.updated_at,
        }
      end

      # Stats helpers

      def events_by_type(events)
        events.group_by(&:event_type).transform_values(&:count)
      end

      def events_by_day(events, start_time, days)
        grouped = events.group_by { |e| e.occurred_at.to_date }
        (0...days).map do |i|
          date        = (start_time + i.days).to_date
          day_events  = grouped[date] || []
          type_counts = day_events.group_by(&:event_type).transform_values(&:count)
          { date: date.iso8601, count: day_events.count, types: type_counts }
        end
      end

      def weight_series(events)
        events
          .select { |e| e.event_type == "weight" }
          .sort_by(&:occurred_at)
          .filter_map do |e|
            val = e.details&.dig("weight_value")&.to_f
            next if val.nil? || val.zero?
            { occurred_at: e.occurred_at.iso8601, value: val, unit: e.details["weight_unit"] || "kg" }
          end
      end

      def events_by_member(events)
        user_ids = events.map(&:logged_by_id).uniq
        users    = User.where(id: user_ids).index_by(&:id)
        events.group_by(&:logged_by_id).map do |uid, user_events|
          { user_id: uid, name: users[uid]&.name || "Unknown", count: user_events.count }
        end
      end
    end
  end
end
