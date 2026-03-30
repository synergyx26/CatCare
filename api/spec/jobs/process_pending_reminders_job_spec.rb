require 'rails_helper'

RSpec.describe ProcessPendingRemindersJob, type: :job do
  include ActiveJob::TestHelper
  include ActiveSupport::Testing::TimeHelpers

  let(:household) { create(:household) }
  let(:admin)     { create(:user) }
  let(:cat)       { create(:cat, household: household) }
  let!(:membership) do
    create(:household_membership, household: household, user: admin, role: :admin, status: :active)
  end

  let(:due_time) { 10.minutes.ago }

  def build_reminder(attrs = {})
    create(:reminder,
      cat:                cat,
      household:          household,
      care_type:          :feeding,
      schedule_type:      :daily,
      schedule_value:     '08:00',
      active:             true,
      notify_all_members: true,
      next_trigger_at:    due_time,
      **attrs)
  end

  describe '#perform' do
    context 'when a reminder is due' do
      it 'enqueues an email for each active member' do
        reminder = build_reminder
        expect {
          described_class.new.perform
        }.to have_enqueued_mail(UserMailer, :reminder_notification).with(reminder, admin, cat)
      end

      it 'updates last_triggered_at and next_trigger_at after firing' do
        reminder = build_reminder
        described_class.new.perform
        reminder.reload
        expect(reminder.last_triggered_at).not_to be_nil
        expect(reminder.next_trigger_at).to be > due_time
      end
    end

    context 'when all_cats is true' do
      let(:cat2) { create(:cat, household: household) }

      it 'enqueues one email per active cat' do
        cat2  # force creation
        reminder = build_reminder(cat: nil, all_cats: true)
        expect {
          described_class.new.perform
        }.to have_enqueued_mail(UserMailer, :reminder_notification).with(reminder, admin, cat)
          .and have_enqueued_mail(UserMailer, :reminder_notification).with(reminder, admin, cat2)
      end

      it 'suppresses per-cat when that cat already has a care event today' do
        cat2  # force creation
        # log care for cat but not cat2
        create(:care_event, cat: cat, household: household, event_type: :feeding,
               occurred_at: Time.current.utc.beginning_of_day + 1.hour)
        reminder = build_reminder(cat: nil, all_cats: true)
        expect {
          described_class.new.perform
        }.to have_enqueued_mail(UserMailer, :reminder_notification).exactly(:once)
          .and have_enqueued_mail(UserMailer, :reminder_notification).with(reminder, admin, cat2)
      end
    end

    context 'smart suppression' do
      it 'does not send email when a matching care event was logged today' do
        create(:care_event,
          cat:        cat,
          household:  household,
          event_type: :feeding,
          occurred_at: Time.current.utc.beginning_of_day + 1.hour)
        build_reminder
        expect {
          described_class.new.perform
        }.not_to have_enqueued_mail(UserMailer, :reminder_notification)
      end

      it 'still advances next_trigger_at when suppressed' do
        create(:care_event,
          cat:        cat,
          household:  household,
          event_type: :feeding,
          occurred_at: Time.current.utc.beginning_of_day + 1.hour)
        reminder = build_reminder
        described_class.new.perform
        reminder.reload
        expect(reminder.next_trigger_at).to be > due_time
      end
    end

    context 'when email.enabled is false' do
      it 'skips that user' do
        admin.update!(notification_preferences: admin.notification_preferences.deep_merge(
          "email" => { "enabled" => false }
        ))
        build_reminder
        expect {
          described_class.new.perform
        }.not_to have_enqueued_mail(UserMailer, :reminder_notification)
      end
    end

    context 'when the care-type sub-preference is false' do
      it 'skips a user with care_reminders disabled' do
        admin.update!(notification_preferences: admin.notification_preferences.deep_merge(
          "email" => { "care_reminders" => false }
        ))
        build_reminder(care_type: :feeding)
        expect {
          described_class.new.perform
        }.not_to have_enqueued_mail(UserMailer, :reminder_notification)
      end

      it 'skips a user with medication_alerts disabled' do
        admin.update!(notification_preferences: admin.notification_preferences.deep_merge(
          "email" => { "medication_alerts" => false }
        ))
        build_reminder(care_type: :medication)
        expect {
          described_class.new.perform
        }.not_to have_enqueued_mail(UserMailer, :reminder_notification)
      end
    end

    context 'when reminder is inactive' do
      it 'does not process the reminder' do
        build_reminder(active: false)
        expect {
          described_class.new.perform
        }.not_to have_enqueued_mail(UserMailer, :reminder_notification)
      end
    end

    context 'when notify_all_members is false' do
      it 'sends only to listed recipients' do
        other_user = create(:user)
        create(:household_membership, household: household, user: other_user, role: :member, status: :active)
        reminder = build_reminder(notify_all_members: false)
        create(:reminder_recipient, reminder: reminder, user: admin)

        expect {
          described_class.new.perform
        }.to have_enqueued_mail(UserMailer, :reminder_notification).exactly(:once)
          .and have_enqueued_mail(UserMailer, :reminder_notification).with(reminder, admin, cat)
      end
    end

    context 'when individual reminder processing raises an error' do
      it 'continues processing remaining reminders' do
        build_reminder
        build_reminder

        call_count = 0
        allow_any_instance_of(described_class).to receive(:process_reminder) do |_instance, _reminder|
          call_count += 1
          raise StandardError, "boom" if call_count == 1
        end

        expect { described_class.new.perform }.not_to raise_error
      end
    end
  end
end
