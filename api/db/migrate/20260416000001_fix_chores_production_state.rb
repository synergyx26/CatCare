class FixChoresProductionState < ActiveRecord::Migration[8.1]
  # This migration is idempotent. It repairs all known partial-migration states
  # that can result if migration 20260415100002 (or later) failed and rolled back
  # in production.
  #
  # Safe to run even when the schema is already fully up-to-date — each step
  # guards with column_exists? / NOT EXISTS checks before acting.
  def up
    # ── Step 1: Ensure frequency_per_day exists on definitions ───────────────
    # (migration 200001 might not have run if 100002 failed before it)
    unless column_exists?(:household_chore_definitions, :frequency_per_day)
      add_column :household_chore_definitions, :frequency_per_day, :integer, null: false, default: 1
    end

    # ── Step 2: Seed default definitions for any household that lacks them ───
    # Uses NOT EXISTS so it won't duplicate definitions that were created by
    # a successful earlier run.
    seed_missing_household_definitions!

    # ── Step 3: Repair the chore → definition FK if migration 100002 failed ──
    # chore_type still present = migration 100002 rolled back entirely.
    if column_exists?(:household_chores, :chore_type)
      repair_chore_definition_fk!
    end

    # ── Step 4: Remove stale track_water / track_litter columns from households
    # (migration 100003 might not have run)
    remove_column :households, :track_water  if column_exists?(:households, :track_water)
    remove_column :households, :track_litter if column_exists?(:households, :track_litter)
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end

  private

  # Creates "Litter boxes" and "Water fountain" definitions for every household
  # that doesn't already have them. Idempotent.
  def seed_missing_household_definitions!
    execute <<~SQL
      INSERT INTO household_chore_definitions
        (household_id, name, emoji, active, position, frequency_per_day, created_at, updated_at)
      SELECT h.id, 'Litter boxes', '🧹', true, 0, 1, NOW(), NOW()
      FROM households h
      WHERE NOT EXISTS (
        SELECT 1 FROM household_chore_definitions hcd
        WHERE hcd.household_id = h.id AND hcd.name = 'Litter boxes'
      );
    SQL

    execute <<~SQL
      INSERT INTO household_chore_definitions
        (household_id, name, emoji, active, position, frequency_per_day, created_at, updated_at)
      SELECT h.id, 'Water fountain', '💧', true, 1, 1, NOW(), NOW()
      FROM households h
      WHERE NOT EXISTS (
        SELECT 1 FROM household_chore_definitions hcd
        WHERE hcd.household_id = h.id AND hcd.name = 'Water fountain'
      );
    SQL
  end

  # Runs the data migration that converts the old chore_type integer enum to
  # proper FK references against household_chore_definitions.
  # Called only when chore_type still exists (i.e. migration 100002 rolled back).
  def repair_chore_definition_fk!
    # Add chore_definition_id FK column (nullable first so we can backfill)
    unless column_exists?(:household_chores, :chore_definition_id)
      add_reference :household_chores, :chore_definition,
                    null: true,
                    foreign_key: { to_table: :household_chore_definitions }
    end

    # Backfill: point litter chores (chore_type = 0) to "Litter boxes"
    execute <<~SQL
      UPDATE household_chores hc
      SET chore_definition_id = hcd.id
      FROM household_chore_definitions hcd
      WHERE hc.household_id   = hcd.household_id
        AND hcd.name          = 'Litter boxes'
        AND hc.chore_type     = 0
        AND hc.chore_definition_id IS NULL;
    SQL

    # Backfill: point water chores (chore_type = 1) to "Water fountain"
    execute <<~SQL
      UPDATE household_chores hc
      SET chore_definition_id = hcd.id
      FROM household_chore_definitions hcd
      WHERE hc.household_id   = hcd.household_id
        AND hcd.name          = 'Water fountain'
        AND hc.chore_type     = 1
        AND hc.chore_definition_id IS NULL;
    SQL

    # Safety net: any remaining NULLs (unexpected chore_type values) get assigned
    # to the first definition for their household so we can safely enforce NOT NULL.
    execute <<~SQL
      UPDATE household_chores hc
      SET chore_definition_id = (
        SELECT id FROM household_chore_definitions
        WHERE household_id = hc.household_id
        ORDER BY position ASC, id ASC
        LIMIT 1
      )
      WHERE hc.chore_definition_id IS NULL;
    SQL

    # Enforce NOT NULL — safe now that all rows are backfilled
    change_column_null :household_chores, :chore_definition_id, false

    # Drop the obsolete chore_type column
    remove_column :household_chores, :chore_type
  end
end
