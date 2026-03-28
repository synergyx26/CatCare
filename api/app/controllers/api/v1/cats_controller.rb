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

        active_count = current_household.cats.active.count
        limit = tier_cat_limit
        if active_count >= limit
          return render_error(
            "TIER_LIMIT",
            "Your plan allows #{limit} active #{limit == 1 ? 'cat' : 'cats'}. Upgrade to add more.",
            status: :forbidden
          )
        end

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
        range  = params[:range] || "30d"

        unless tier_range_allowed?(range)
          return render_error(
            "TIER_LIMIT",
            "Upgrade your plan to access this date range",
            status: :forbidden
          )
        end

        offset = [params[:offset].to_i, 0].max
        days   = case range
                 when "7d"  then 7
                 when "90d" then 90
                 else 30
                 end

        max = tier_max_offset(days)
        if offset > max
          return render_error("TIER_LIMIT",
            "Upgrade your plan to access this historical period",
            status: :forbidden)
        end

        end_time   = offset.zero? ? Time.current.end_of_day : (days * offset).days.ago.end_of_day
        start_time = (days * (offset + 1)).days.ago.beginning_of_day
        events     = @cat.care_events.where(occurred_at: start_time..end_time).to_a

        render_success({
          range:           range,
          offset:          offset,
          start_date:      start_time.iso8601,
          end_date:        end_time.iso8601,
          total_events:    events.count,
          by_type:         events_by_type(events),
          by_day:          events_by_day(events, start_time, days),
          weight_series:   weight_series(events),
          by_member:       events_by_member(events),
          feeding_series:  feeding_series_by_day(events, start_time, days),
          symptom_series:  symptom_series(events),
        })
      end

      private

      # Returns a URL only when the blob is stored in the currently configured service.
      #
      # Production: returns a direct Supabase public-bucket URL (no Rails redirect).
      #   This means image loading doesn't require Render to be awake, never expires,
      #   and works reliably after page refreshes. Requires the bucket to be set to
      #   public in Supabase Dashboard → Storage → <bucket> → Make public.
      #
      # Development: uses the Rails redirect URL (local disk service).
      #
      # In both cases, blobs recorded against a different service (e.g. "local" blobs
      # that predate the Supabase migration) return nil so the frontend shows the avatar
      # placeholder and the user can re-upload.
      def photo_url_for(cat)
        return nil unless cat.photo.attached?
        blob = cat.photo.blob

        if Rails.env.production?
          endpoint = ENV["SUPABASE_S3_ENDPOINT"]
          bucket   = ENV["SUPABASE_S3_BUCKET"]
          return nil if endpoint.blank? || bucket.blank? || blob.service_name != "supabase"
          # e.g. https://<ref>.supabase.co/storage/v1/s3 → https://<ref>.supabase.co/storage/v1
          base = endpoint.delete_suffix("/s3")
          "#{base}/object/public/#{bucket}/#{blob.key}"
        else
          current_service = Rails.application.config.active_storage.service.to_s
          return nil unless blob.service_name == current_service
          url_for(cat.photo)
        end
      end

      def set_cat
        @cat = current_household.cats.with_attached_photo.find(params[:id])
      end

      def cat_params
        permitted = params.require(:cat).permit(
          :name, :species, :sex, :sterilized,
          :birthday, :breed, :microchip_number, :health_notes, :active, :deceased, :photo,
          :vet_name, :vet_clinic, :vet_phone, :vet_address, :care_instructions,
          :feedings_per_day, :track_water, :track_litter, :track_toothbrushing,
          feeding_presets: { wet: [], dry: [], treats: [], other: [] }
        )
        if params[:cat].key?(:health_conditions)
          raw = Array(params[:cat][:health_conditions]).map(&:to_s).reject(&:blank?).uniq
          permitted[:health_conditions] = raw
        end
        permitted
      end

      def cat_json(cat)
        {
          id:                  cat.id,
          household_id:        cat.household_id,
          name:                cat.name,
          species:             cat.species,
          sex:                 cat.sex,
          sterilized:          cat.sterilized,
          birthday:            cat.birthday,
          breed:               cat.breed,
          microchip_number:    cat.microchip_number,
          health_notes:        cat.health_notes,
          health_conditions:   cat.health_conditions,
          active:              cat.active,
          deceased:            cat.deceased,
          created_by:          cat.created_by_id,
          photo_url:           photo_url_for(cat),
          vet_name:            cat.vet_name,
          vet_clinic:          cat.vet_clinic,
          vet_phone:           cat.vet_phone,
          vet_address:         cat.vet_address,
          care_instructions:   cat.care_instructions,
          feedings_per_day:     cat.feedings_per_day,
          track_water:          cat.track_water,
          track_litter:         cat.track_litter,
          track_toothbrushing:  cat.track_toothbrushing,
          feeding_presets:     cat.feeding_presets,
          created_at:          cat.created_at,
          updated_at:          cat.updated_at,
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

      # Returns the furthest-back offset allowed for this user's tier.
      # Pro allows data up to 180 days old; Premium is unlimited.
      def tier_max_offset(days)
        case current_user.subscription_tier
        when "pro"     then (180.0 / days).floor - 1
        when "premium" then Float::INFINITY
        else 0  # free
        end
      end

      # Free: 7d only. Pro: 7d/30d. Premium: all ranges.
      def tier_range_allowed?(range)
        case current_user.subscription_tier
        when "premium" then true
        when "pro"     then %w[7d 30d].include?(range)
        else range == "7d"
        end
      end

      # Free: 1 cat. Pro: 3. Premium: unlimited.
      def tier_cat_limit
        case current_user.subscription_tier
        when "premium" then Float::INFINITY
        when "pro"     then 3
        else 1
        end
      end

      def feeding_series_by_day(events, start_time, days)
        feeding_events = events.select { |e| e.event_type == "feeding" }
        grouped = feeding_events.group_by { |e| e.occurred_at.to_date }
        known_types = %w[wet dry treats other]

        (0...days).map do |i|
          date = (start_time + i.days).to_date
          day_events = grouped[date] || []

          totals = known_types.index_with { 0.0 }
          day_events.each do |e|
            food_type = e.details&.dig("food_type").to_s.strip.downcase
            food_type = "other" unless known_types.include?(food_type)
            totals[food_type] += e.details&.dig("amount_grams").to_f
          end

          { date: date.iso8601, wet: totals["wet"], dry: totals["dry"], treats: totals["treats"], other: totals["other"] }
        end
      end

      def events_by_member(events)
        user_ids = events.map(&:logged_by_id).uniq
        users    = User.where(id: user_ids).index_by(&:id)
        events.group_by(&:logged_by_id).map do |uid, user_events|
          { user_id: uid, name: users[uid]&.name || "Unknown", count: user_events.count }
        end
      end

      def symptom_series(events)
        events
          .select { |e| e.event_type == "symptom" }
          .sort_by(&:occurred_at)
          .map do |e|
            {
              occurred_at:      e.occurred_at.iso8601,
              symptom_type:     e.details&.dig("symptom_type"),
              severity:         e.details&.dig("severity"),
              duration_minutes: e.details&.dig("duration_minutes"),
            }
          end
      end
    end
  end
end
