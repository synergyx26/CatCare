module Api
  module V1
    class CareNotesController < BaseController
      before_action :set_household

      # GET /api/v1/households/:household_id/care_notes
      # Optional params: cat_id, category
      def index
        authorize @household, policy_class: CareNotePolicy
        notes = @household.care_notes.includes(:creator, :cat).ordered

        if params[:cat_id].present?
          # Return notes for this cat PLUS household-level notes (nil cat_id)
          # so a sitter reading a cat profile sees both in one fetch.
          notes = notes.where(cat_id: [ params[:cat_id], nil ])
        end

        notes = notes.where(category: params[:category]) if params[:category].present?

        render_success(notes.map { |n| serialize_note(n) }, meta: { total: notes.count })
      end

      # POST /api/v1/households/:household_id/care_notes
      def create
        note = @household.care_notes.build(note_params)
        note.created_by_id = current_user.id
        authorize note

        if note.save
          render_success(serialize_note(note), status: :created)
        else
          render_error("VALIDATION_ERROR", note.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      # PATCH /api/v1/households/:household_id/care_notes/:id
      def update
        note = @household.care_notes.find(params[:id])
        authorize note

        if note.update(note_params)
          render_success(serialize_note(note))
        else
          render_error("VALIDATION_ERROR", note.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      # DELETE /api/v1/households/:household_id/care_notes/:id
      def destroy
        note = @household.care_notes.find(params[:id])
        authorize note
        note.destroy
        render_success({ deleted: true })
      end

      private

      def set_household
        @household = current_household
      end

      def note_params
        params.require(:care_note).permit(:cat_id, :category, :title, :body, :position)
      end

      def serialize_note(note)
        {
          id:            note.id,
          household_id:  note.household_id,
          cat_id:        note.cat_id,
          created_by_id: note.created_by_id,
          created_by:    note.creator&.name,
          category:      note.category,
          title:         note.title,
          body:          note.body,
          position:      note.position,
          created_at:    note.created_at,
          updated_at:    note.updated_at,
        }
      end
    end
  end
end
