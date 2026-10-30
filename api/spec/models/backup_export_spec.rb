require "rails_helper"

RSpec.describe BackupExport, type: :model do
  describe ".prune!" do
    it "removes exports older than the retention window" do
      old = create(:backup_export, created_at: 40.days.ago)
      recent = create(:backup_export, created_at: 1.day.ago)
      described_class.prune!
      expect(described_class.all).to contain_exactly(recent)
      expect(described_class.exists?(old.id)).to be(false)
    end

    it "never deletes the newest successful export, even if it is old" do
      only = create(:backup_export, created_at: 90.days.ago)
      create(:backup_export, status: "failed", created_at: 1.day.ago)
      described_class.prune!
      expect(described_class.exists?(only.id)).to be(true)
    end
  end
end
