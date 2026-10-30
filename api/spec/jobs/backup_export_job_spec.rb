require "rails_helper"

RSpec.describe BackupExportJob do
  let!(:admin) { create(:user, email: "boss@example.com") }
  let!(:other) { create(:user) }

  before { stub_const("ENV", ENV.to_h.merge("SUPER_ADMIN_EMAIL" => "boss@example.com")) }

  it "exports and tells only super admins it is ready" do
    described_class.perform_now
    expect(BackupExport.last.status).to eq("ok")
    expect(admin.notifications.pluck(:kind)).to eq(["backup.ready"])
    expect(other.notifications).to be_empty
  end

  it "tells super admins when the backup fails, without raising" do
    allow(Backups::CsvExporter).to receive(:call).and_raise(RuntimeError, "no space left")
    expect { described_class.perform_now }.not_to raise_error
    expect(admin.notifications.pluck(:kind)).to eq(["backup.failed"])
  end
end
