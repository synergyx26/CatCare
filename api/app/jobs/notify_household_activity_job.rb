# Tells the rest of the household when something was *added* — a cat, a note,
# an expense, a trip, a reminder, a chore, a new member. (Care events have
# their own richer job: NotifyCareEventJob.)
#
#   NotifyHouseholdActivityJob.perform_later(record, current_user.id)
#
# One place so every new kind of addition gets the same rules: everyone in the
# household except the person who did it, inbox always, push per their
# preferences, and a quick burst from one person folded into one notification.
class NotifyHouseholdActivityJob < ApplicationJob
  queue_as :default
  discard_on ActiveRecord::RecordNotFound, ActiveJob::DeserializationError

  COALESCE_WINDOW = 2.minutes

  Spec = Struct.new(:kind, :category, :title, :body, :url, :label, :verb, :noun, :coalesce, keyword_init: true)

  def perform(record, actor_id)
    spec = spec_for(record, actor_name(record, actor_id))
    return unless spec

    household = record.is_a?(Household) ? record : record.household
    recipients(household, actor_id).each { |user| deliver(user, household, actor_id, spec) }
  end

  private

  def actor_name(record, actor_id)
    (record.is_a?(HouseholdMembership) ? record.user : User.find_by(id: actor_id))&.name || "Someone"
  end

  def recipients(household, actor_id)
    household.household_memberships.includes(:user).select(&:active?).map(&:user).compact.reject { |u| u.id == actor_id }
  end

  def deliver(user, household, actor_id, spec)
    item = { "text" => spec.label }
    opts = { kind: spec.kind, category: spec.category, title: spec.title, body: spec.body, url: spec.url,
             data: { "household_id" => household.id, "actor_id" => actor_id, "items" => [item] } }

    if spec.coalesce
      Notifications::Notifier.call(user, **opts, coalesce: { key: "#{spec.kind}:#{household.id}:#{actor_id}", within: COALESCE_WINDOW }) do |existing|
        items = (existing.data["items"] || []) + [item]
        { title: "#{spec.verb} #{items.size} #{spec.noun}", body: items.map { |i| i["text"] }.join(" · ").truncate(180), url: "/dashboard",
          data: existing.data.merge("items" => items) }
      end
    else
      Notifications::Notifier.call(user, **opts)
    end
  end

  # ── What each kind of record says ─────────────────────────────────────────
  def spec_for(record, who)
    case record
    when Cat
      Spec.new(kind: "cat.added", category: "household_updates", title: "#{record.name} was added by #{who}",
               body: [record.breed.presence, ("born #{record.birthday}" if record.birthday)].compact.join(" · ").presence,
               url: "/households/#{record.household_id}/cats/#{record.id}", label: record.name,
               verb: "#{who} added", noun: "cats", coalesce: true)
    when CareNote
      Spec.new(kind: "note.added", category: "notes", title: "#{who} added a note: #{record.title}".truncate(120),
               body: record.body.to_s.truncate(160).presence, url: "/dashboard", label: record.title,
               verb: "#{who} added", noun: "notes", coalesce: true)
    when PetExpense
      total = (record.quantity.to_d * record.unit_price.to_d).round(2)
      cost  = "#{'%.2f' % total} #{record.household.try(:currency).presence}".strip
      Spec.new(kind: "expense.added", category: "expenses", title: "#{who} logged an expense: #{record.product_name}".truncate(120),
               body: "#{cost} · #{record.category.to_s.humanize}", url: "/households/#{record.household_id}/expenses",
               label: "#{record.product_name} (#{cost})", verb: "#{who} logged", noun: "expenses", coalesce: true)
    when VacationTrip
      range = [record.start_date, record.end_date].compact.join(" → ")
      Spec.new(kind: "trip.added", category: "household_updates", title: "#{who} scheduled a vacation trip",
               body: range.presence, url: "/households/#{record.household_id}/vacation", label: range, verb: "#{who} scheduled", noun: "trips", coalesce: false)
    when Reminder
      Spec.new(kind: "reminder.added", category: "household_updates", title: "#{who} added a reminder: #{record.title}".truncate(120),
               body: nil, url: "/dashboard", label: record.title, verb: "#{who} added", noun: "reminders", coalesce: true)
    when HouseholdChore
      name = record.chore_definition&.name || "a chore"
      emoji = record.chore_definition&.emoji.to_s
      Spec.new(kind: "chore.logged", category: "care_activity", title: "#{[emoji.presence, name].compact.join(' ')} done by #{who}",
               body: record.notes.presence, url: "/dashboard", label: name, verb: "#{who} completed", noun: "chores", coalesce: true)
    when HouseholdChoreDefinition
      Spec.new(kind: "chore.defined", category: "household_updates", title: "#{who} added a chore: #{record.name}",
               body: nil, url: "/dashboard", label: record.name, verb: "#{who} added", noun: "chores", coalesce: true)
    when HouseholdMembership
      Spec.new(kind: "member.joined", category: "household_updates", title: "#{who} joined #{record.household.name}",
               body: "Role: #{record.role}", url: "/dashboard", label: who, verb: "", noun: "", coalesce: false)
    end
  end
end
