class AddAppearanceToCats < ActiveRecord::Migration[8.1]
  # Cartoon look for the playful UI preview: { pattern, fur, fur2, fur3, eyes }.
  # Nullable — null means "not set", and the web app falls back to a coat
  # picked from the cat's id. Shape is validated in Cat#appearance_shape.
  def change
    add_column :cats, :appearance, :jsonb
  end
end
