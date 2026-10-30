module Api
  module V1
    module Admin
      class BackupsController < BaseController
        # GET /api/v1/admin/backups
        def index
          exports = BackupExport.recent.includes(:requested_by).limit(100)
          render json: { data: exports.map { |e| serialize(e) }, meta: { total: BackupExport.count } }
        end

        # POST /api/v1/admin/backups — runs the export in the background; the
        # requester gets a notification when it's ready.
        def create
          BackupExportJob.perform_later(current_user.id)
          render json: { data: { queued: true } }, status: :accepted
        end

        # GET /api/v1/admin/backups/:id/download
        def download
          export = BackupExport.find(params[:id])
          return render json: { error: "NOT_FOUND", message: "Backup has no file" }, status: :not_found unless export.ok? && export.file.attached?

          send_data export.file.download, filename: export.filename, type: "application/zip", disposition: "attachment"
        end

        private

        def serialize(e)
          { id: e.id, kind: e.kind, status: e.status, byte_size: e.byte_size,
            checksum_sha256: e.checksum_sha256, table_counts: e.table_counts, error: e.error,
            requested_by: e.requested_by&.name, filename: e.filename,
            created_at: e.created_at.utc.iso8601 }
        end
      end
    end
  end
end
