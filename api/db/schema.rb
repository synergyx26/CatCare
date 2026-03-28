# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_03_28_000002) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "care_events", force: :cascade do |t|
    t.bigint "cat_id", null: false
    t.datetime "created_at", null: false
    t.jsonb "details", default: {}
    t.integer "event_type", default: 0, null: false
    t.bigint "household_id", null: false
    t.integer "logged_by_id", null: false
    t.text "notes"
    t.datetime "occurred_at", null: false
    t.datetime "updated_at", null: false
    t.index ["cat_id"], name: "index_care_events_on_cat_id"
    t.index ["details"], name: "index_care_events_on_details", using: :gin
    t.index ["event_type"], name: "index_care_events_on_event_type"
    t.index ["household_id"], name: "index_care_events_on_household_id"
    t.index ["occurred_at"], name: "index_care_events_on_occurred_at"
  end

  create_table "care_notes", force: :cascade do |t|
    t.text "body", null: false
    t.bigint "cat_id"
    t.integer "category", default: 0, null: false
    t.datetime "created_at", null: false
    t.integer "created_by_id", null: false
    t.bigint "household_id", null: false
    t.integer "position", default: 0, null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.index ["cat_id"], name: "index_care_notes_on_cat_id"
    t.index ["household_id", "cat_id", "category"], name: "index_care_notes_on_household_id_and_cat_id_and_category"
    t.index ["household_id", "cat_id", "position"], name: "index_care_notes_on_household_id_and_cat_id_and_position"
    t.index ["household_id"], name: "index_care_notes_on_household_id"
  end

  create_table "cats", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.date "birthday"
    t.string "breed"
    t.text "care_instructions"
    t.datetime "created_at", null: false
    t.integer "created_by_id", null: false
    t.boolean "deceased", default: false, null: false
    t.jsonb "feeding_presets", default: {"dry" => [80, 90, 100], "wet" => [50, 60, 70, 80], "other" => [], "treats" => []}, null: false
    t.integer "feedings_per_day", default: 1, null: false
    t.jsonb "health_conditions", default: [], null: false
    t.text "health_notes"
    t.bigint "household_id", null: false
    t.string "microchip_number"
    t.string "name", null: false
    t.integer "sex", default: 0
    t.integer "species", default: 0, null: false
    t.boolean "sterilized", default: false
    t.boolean "track_litter", default: true, null: false
    t.boolean "track_toothbrushing", default: false, null: false
    t.boolean "track_water", default: true, null: false
    t.datetime "updated_at", null: false
    t.string "vet_address"
    t.string "vet_clinic"
    t.string "vet_name"
    t.string "vet_phone"
    t.index ["active"], name: "index_cats_on_active"
    t.index ["health_conditions"], name: "index_cats_on_health_conditions", using: :gin
    t.index ["household_id"], name: "index_cats_on_household_id"
  end

  create_table "household_invites", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.datetime "expires_at", null: false
    t.bigint "household_id", null: false
    t.integer "invited_by_id", null: false
    t.integer "role", default: 0, null: false
    t.integer "status", default: 0, null: false
    t.string "token", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_household_invites_on_email"
    t.index ["household_id"], name: "index_household_invites_on_household_id"
    t.index ["token"], name: "index_household_invites_on_token", unique: true
  end

  create_table "household_memberships", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "emergency_contact_name"
    t.string "emergency_contact_phone"
    t.bigint "household_id", null: false
    t.integer "invited_by_id"
    t.datetime "joined_at"
    t.text "notes"
    t.string "phone"
    t.integer "role", default: 0, null: false
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["household_id", "user_id"], name: "index_household_memberships_on_household_id_and_user_id", unique: true
    t.index ["household_id"], name: "index_household_memberships_on_household_id"
    t.index ["user_id"], name: "index_household_memberships_on_user_id"
  end

  create_table "households", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "created_by"
    t.string "emergency_contact_name"
    t.string "emergency_contact_phone"
    t.string "name"
    t.datetime "updated_at", null: false
    t.string "vet_address"
    t.string "vet_clinic"
    t.string "vet_name"
    t.string "vet_phone"
  end

  create_table "reminder_recipients", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "reminder_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["reminder_id"], name: "index_reminder_recipients_on_reminder_id"
    t.index ["user_id"], name: "index_reminder_recipients_on_user_id"
  end

  create_table "reminders", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.integer "care_type", default: 0, null: false
    t.bigint "cat_id", null: false
    t.datetime "created_at", null: false
    t.integer "created_by_id", null: false
    t.bigint "household_id", null: false
    t.datetime "last_triggered_at"
    t.datetime "next_trigger_at"
    t.boolean "notify_all_members", default: true, null: false
    t.integer "schedule_type", default: 0, null: false
    t.string "schedule_value"
    t.string "title"
    t.datetime "updated_at", null: false
    t.index ["active", "next_trigger_at"], name: "index_reminders_on_active_and_next_trigger_at"
    t.index ["cat_id"], name: "index_reminders_on_cat_id"
    t.index ["household_id"], name: "index_reminders_on_household_id"
    t.index ["next_trigger_at"], name: "index_reminders_on_next_trigger_at"
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "jti", default: "", null: false
    t.string "name", default: "", null: false
    t.string "provider"
    t.datetime "remember_created_at"
    t.datetime "reset_password_sent_at"
    t.string "reset_password_token"
    t.string "subscription_tier", default: "free", null: false
    t.string "uid"
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["jti"], name: "index_users_on_jti", unique: true
    t.index ["provider", "uid"], name: "index_users_on_provider_and_uid", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "care_events", "cats"
  add_foreign_key "care_events", "households"
  add_foreign_key "care_notes", "cats"
  add_foreign_key "care_notes", "households"
  add_foreign_key "cats", "households"
  add_foreign_key "household_invites", "households"
  add_foreign_key "household_memberships", "households"
  add_foreign_key "household_memberships", "users"
  add_foreign_key "reminder_recipients", "reminders"
  add_foreign_key "reminder_recipients", "users"
  add_foreign_key "reminders", "cats"
  add_foreign_key "reminders", "households"
end
