require "rails_helper"

RSpec.describe Backups::CsvExporter do
  it "stores a zip with one CSV per table and records counts + checksum" do
    user = create(:user)
    export = described_class.call(requested_by: user)

    expect(export.status).to eq("ok")
    expect(export.file).to be_attached
    expect(export.table_counts["users"]).to eq(1)
    expect(export.checksum_sha256).to eq(Digest::SHA256.hexdigest(export.file.download))

    names = Zip::File.open_buffer(StringIO.new(export.file.download)).map(&:name)
    expect(names).to include("users.csv", "notifications.csv")
    expect(names).not_to include("schema_migrations.csv")
  end

  it "marks the export failed and re-raises when the dump breaks" do
    allow_any_instance_of(described_class).to receive(:build_zip).and_raise(RuntimeError, "disk full")
    expect { described_class.call }.to raise_error(RuntimeError)
    expect(BackupExport.last).to have_attributes(status: "failed", error: /disk full/)
  end
end
