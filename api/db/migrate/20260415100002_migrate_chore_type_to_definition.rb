class MigrateChoreTypeToDefinition < ActiveRecord::Migration[8.1]
  def up
    # Add nullable FK column first so we can populate it before constraining
    add_reference :household_chores, :chore_definition,
                  null: true,
                  foreign_key: { to_table: :household_chore_definitions }

    # Create default litter + water definitions for every existing household,
    # using their current track_litter / track_water flags to set active state.
    execute <<~SQL
      INSERT INTO household_chore_definitions
        (household_id, name, emoji, active, position, created_at, updated_at)
      SELECT id, 'Litter boxes', '🧹', COALESCE(track_litter, true), 0, NOW(), NOW()
      FROM households;
    SQL

    execute <<~SQL
      INSERT INTO household_chore_definitions
        (household_id, name, emoji, active, position, created_at, updated_at)
      SELECT id, 'Water fountain', '💧', COALESCE(track_water, true), 1, NOW(), NOW()
      FROM households;
    SQL

    # Point existing litter chores (chore_type = 0) to the new litter definition
    execute <<~SQL
      UPDATE household_chores hc
      SET chore_definition_id = hcd.id
      FROM household_chore_definitions hcd
      WHERE hc.household_id = hcd.household_id
        AND hcd.name = 'Litter boxes'
        AND hc.chore_type = 0;
    SQL

    # Point existing water chores (chore_type = 1) to the new water definition
    execute <<~SQL
      UPDATE household_chores hc
      SET chore_definition_id = hcd.id
      FROM household_chore_definitions hcd
      WHERE hc.household_id = hcd.household_id
        AND hcd.name = 'Water fountain'
        AND hc.chore_type = 1;
    SQL

    # Enforce NOT NULL now that data is backfilled
    change_column_null :household_chores, :chore_definition_id, false

    # Drop the old enum column
    remove_column :household_chores, :chore_type
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
