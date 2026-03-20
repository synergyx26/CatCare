# Development seed data — idempotent, safe to re-run.
# Usage: ridk.cmd exec bundle exec rails db:seed

puts "Seeding development data..."

# ── User ──────────────────────────────────────────────────────────────────────
user = User.find_or_create_by!(email: "admin@catcare.dev") do |u|
  u.name     = "Alex"
  u.password = "password123"
  u.password_confirmation = "password123"
  u.jti      = SecureRandom.uuid
end
puts "  User: #{user.email}"

# ── Household ─────────────────────────────────────────────────────────────────
household = Household.find_or_create_by!(creator: user) do |h|
  h.name                       = "The Cat House"
  h.emergency_contact_name     = "Dr. Sarah Mills"
  h.emergency_contact_phone    = "555-0100"
end
puts "  Household: #{household.name}"

# Ensure membership
HouseholdMembership.find_or_create_by!(household: household, user: user) do |m|
  m.role   = :admin
  m.status = :active
end

# ── Cats ──────────────────────────────────────────────────────────────────────
mochi = Cat.find_or_create_by!(household: household, name: "Mochi") do |c|
  c.species            = "cat"
  c.active             = true
  c.creator            = user
  c.vet_name           = "Dr. Lisa Park"
  c.vet_clinic         = "Paw & Claw Vet"
  c.vet_phone          = "555-0200"
  c.care_instructions  = "Needs wet food twice a day. Very affectionate — loves chin scratches."
end
puts "  Cat: #{mochi.name}"

luna = Cat.find_or_create_by!(household: household, name: "Luna") do |c|
  c.species           = "cat"
  c.active            = true
  c.creator           = user
  c.vet_name          = "Dr. Lisa Park"
  c.vet_clinic        = "Paw & Claw Vet"
  c.vet_phone         = "555-0200"
  c.care_instructions = "On daily allergy medication (5mg cetirizine, crushed in food). Shy with strangers."
end
puts "  Cat: #{luna.name}"

# ── Care events (today) ───────────────────────────────────────────────────────
today = Time.current.beginning_of_day

[
  { cat: mochi, event_type: :feeding, occurred_at: today + 7.hours,
    details: { "food_type" => "wet", "amount_grams" => 80 } },
  { cat: mochi, event_type: :water,   occurred_at: today + 7.hours + 5.minutes },
  { cat: luna,  event_type: :feeding, occurred_at: today + 7.hours + 10.minutes,
    details: { "food_type" => "wet", "amount_grams" => 75 } },
  { cat: luna,  event_type: :medication, occurred_at: today + 7.hours + 10.minutes,
    details: { "medication_name" => "Cetirizine", "dosage" => "5", "unit" => "mg" } },
  { cat: mochi, event_type: :litter,  occurred_at: today + 8.hours },
  { cat: luna,  event_type: :litter,  occurred_at: today + 8.hours + 5.minutes },
].each do |attrs|
  CareEvent.find_or_create_by!(
    cat:         attrs[:cat],
    household:   household,
    logged_by:   user,
    event_type:  attrs[:event_type],
    occurred_at: attrs[:occurred_at]
  ) do |e|
    e.details = attrs[:details] || {}
  end
end

puts "  Care events seeded for today"
puts "Done! Sign in at http://localhost:5173/login"
puts "  Email:    admin@catcare.dev"
puts "  Password: password123"
