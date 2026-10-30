# Tells the rest of the household when care has been logged, so everyone
# knows a cat has been fed / the litter is done / meds were given.
#
# Runs in the background so a notification problem can never fail the care
# log itself. One person's burst (e.g. a batch action over several cats) is
# folded into a single evolving notification per recipient.
class NotifyCareEventJob < ApplicationJob
  queue_as :default
  discard_on ActiveRecord::RecordNotFound

  CATEGORY = "care_activity".freeze
  COALESCE_WINDOW = 2.minutes
  # Only "care just done" is news. Back-filled history and future-dated
  # entries (e.g. an upcoming vet appointment) stay quiet.
  MAX_AGE = 12.hours
  MAX_FUTURE = 5.minutes

  def perform(care_event_id)
    event = CareEvent.includes(:cat, :logged_by, household: { household_memberships: :user }).find(care_event_id)
    return unless newsworthy?(event)

    recipients(event).each { |user| notify(user, event) }
  end

  private

  def newsworthy?(event)
    event.occurred_at.present? &&
      event.occurred_at >= MAX_AGE.ago && event.occurred_at <= MAX_FUTURE.from_now
  end

  def recipients(event)
    event.household.household_memberships.select(&:active?).map(&:user).compact
         .reject { |u| u.id == event.logged_by_id }
  end

  def notify(user, event)
    item = { "cat_id" => event.cat_id, "event_type" => event.event_type, "text" => item_text(event) }
    actor = event.logged_by&.name || "Someone"

    Notifications::Notifier.call(
      user, kind: "care.logged", category: CATEGORY,
      title: single_title(item, actor), body: detail_for(event), url: "/households/#{event.household_id}/cats/#{event.cat_id}",
      data: { "household_id" => event.household_id, "actor_id" => event.logged_by_id, "items" => [item] },
      coalesce: { key: "care:#{event.household_id}:#{event.logged_by_id}", within: COALESCE_WINDOW }
    ) do |existing|
      items = (existing.data["items"] || []) + [item]
      {
        title: "#{actor} logged #{items.size} care items",
        body: items.map { |i| i["text"] }.join(" · ").truncate(180),
        url: "/dashboard",
        data: existing.data.merge("items" => items)
      }
    end
  end

  def single_title(item, actor) = "#{item['text']} by #{actor}"

  def item_text(event)
    cat = event.cat.name
    details = event.details || {}
    case event.event_type
    when "feeding"    then "#{cat} fed"
    when "litter"     then "#{cat}'s litter cleaned"
    when "water"      then "#{cat}'s water refreshed"
    when "weight"     then "#{cat} weighed"
    when "note"       then "Note added for #{cat}"
    when "medication" then details["supply_refill"] ? "New medication supply for #{cat}" : "#{cat} given medication"
    when "vet_visit"  then "Vet visit logged for #{cat}"
    when "grooming"   then "#{cat} groomed"
    else "Care logged for #{cat}"
    end
  end

  # Extra line under the title for the common cases; never raises on odd data.
  def detail_for(event)
    d = event.details || {}
    parts =
      case event.event_type
      when "feeding"    then [d["food_type"], ([d["amount_grams"], d["unit"]].compact.join(" ").presence)]
      when "weight"     then [([d["weight_value"], d["weight_unit"]].compact.join(" ").presence)]
      when "medication" then [d["medication_name"], d["dosage"] && "#{d['dosage']}#{d['unit']}"]
      end
    parts = Array(parts).compact_blank
    parts << event.notes if event.notes.present?
    parts.join(" · ").truncate(160).presence
  end
end
