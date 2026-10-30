class BackupExport < ApplicationRecord
  STATUSES = %w[pending ok failed].freeze
  KEEP_DAYS = 30

  belongs_to :requested_by, class_name: "User", optional: true
  has_one_attached :file

  validates :status, inclusion: { in: STATUSES }

  scope :recent, -> { order(created_at: :desc) }

  def ok? = status == "ok"

  def filename
    "catcare-#{created_at.utc.strftime('%Y%m%dT%H%M%SZ')}-#{kind}.zip"
  end

  # Delete exports (and their files) past the retention window, but never
  # the newest successful one — there must always be at least one backup.
  def self.prune!(keep_days: KEEP_DAYS)
    newest_ok = where(status: "ok").order(created_at: :desc).first
    where("created_at < ?", keep_days.days.ago).where.not(id: newest_ok&.id).find_each do |export|
      export.file.purge if export.file.attached?
      export.destroy
    end
  end
end
