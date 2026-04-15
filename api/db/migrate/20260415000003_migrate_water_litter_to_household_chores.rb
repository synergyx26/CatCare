class MigrateWaterLitterToHouseholdChores < ActiveRecord::Migration[8.0]
  def up
    # Copy existing litter (1) and water (2) CareEvents into household_chores
    # chore_type: litter=0, water=1 (maps from care_event event_type 1->0, 2->1)
    execute <<~SQL
      INSERT INTO household_chores (household_id, logged_by_id, chore_type, occurred_at, notes, created_at, updated_at)
      SELECT
        household_id,
        logged_by_id,
        CASE event_type
          WHEN 1 THEN 0
          WHEN 2 THEN 1
        END AS chore_type,
        occurred_at,
        notes,
        NOW(),
        NOW()
      FROM care_events
      WHERE event_type IN (1, 2)
    SQL

    # Set household track_water / track_litter based on whether any cat in the household had it enabled
    execute <<~SQL
      UPDATE households h
      SET track_litter = EXISTS (
        SELECT 1 FROM cats c WHERE c.household_id = h.id AND c.track_litter = TRUE
      ),
      track_water = EXISTS (
        SELECT 1 FROM cats c WHERE c.household_id = h.id AND c.track_water = TRUE
      )
    SQL
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
