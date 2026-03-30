require 'rails_helper'

RSpec.describe Reminder, type: :model do
  include ActiveSupport::Testing::TimeHelpers
  describe '#calculate_next_trigger_at' do
    let(:cat)      { create(:cat) }
    let(:reminder) { build(:reminder, cat: cat, household: cat.household) }

    # ── daily ────────────────────────────────────────────────────────────────

    context 'when schedule_type is daily' do
      before { reminder.schedule_type = :daily }

      it 'returns today at the given time when that time has not yet passed' do
        travel_to Time.utc(2026, 3, 30, 7, 0, 0) do
          reminder.schedule_value = '08:00'
          result = reminder.calculate_next_trigger_at
          expect(result).to eq(Time.utc(2026, 3, 30, 8, 0, 0))
        end
      end

      it 'returns tomorrow at the given time when that time has already passed' do
        travel_to Time.utc(2026, 3, 30, 9, 0, 0) do
          reminder.schedule_value = '08:00'
          result = reminder.calculate_next_trigger_at
          expect(result).to eq(Time.utc(2026, 3, 31, 8, 0, 0))
        end
      end

      it 'advances 24 hours from last_triggered_at when after_fire: true' do
        last_fired = Time.utc(2026, 3, 30, 8, 0, 0)
        reminder.schedule_value    = '08:00'
        reminder.last_triggered_at = last_fired
        result = reminder.calculate_next_trigger_at(after_fire: true)
        expect(result).to eq(last_fired + 24.hours)
      end

      it 'uses Time.current as base when after_fire: true and last_triggered_at is nil' do
        travel_to Time.utc(2026, 3, 30, 8, 0, 0) do
          reminder.schedule_value    = '08:00'
          reminder.last_triggered_at = nil
          result = reminder.calculate_next_trigger_at(after_fire: true)
          expect(result).to eq(Time.current + 24.hours)
        end
      end
    end

    # ── interval ─────────────────────────────────────────────────────────────

    context 'when schedule_type is interval' do
      before { reminder.schedule_type = :interval }

      it 'returns now + N hours' do
        travel_to Time.utc(2026, 3, 30, 10, 0, 0) do
          reminder.schedule_value = '12'
          result = reminder.calculate_next_trigger_at
          expect(result).to eq(Time.current + 12.hours)
        end
      end

      it 'advances from last_triggered_at when after_fire: true' do
        last_fired = Time.utc(2026, 3, 30, 6, 0, 0)
        reminder.schedule_value    = '6'
        reminder.last_triggered_at = last_fired
        result = reminder.calculate_next_trigger_at(after_fire: true)
        expect(result).to eq(last_fired + 6.hours)
      end

      it 'uses Time.current as base when after_fire: true and last_triggered_at is nil' do
        travel_to Time.utc(2026, 3, 30, 10, 0, 0) do
          reminder.schedule_value    = '4'
          reminder.last_triggered_at = nil
          result = reminder.calculate_next_trigger_at(after_fire: true)
          expect(result).to eq(Time.current + 4.hours)
        end
      end
    end

    # ── weekly ────────────────────────────────────────────────────────────────

    context 'when schedule_type is weekly' do
      before { reminder.schedule_type = :weekly }

      it 'finds the next occurrence of the target weekday' do
        # 2026-03-30 is a Monday; next Tuesday is 2026-03-31
        travel_to Time.utc(2026, 3, 30, 10, 0, 0) do
          reminder.schedule_value = 'tuesday'
          result = reminder.calculate_next_trigger_at
          expect(result.to_date).to eq(Date.new(2026, 3, 31))
        end
      end

      it 'uses the time portion from schedule_value when provided' do
        travel_to Time.utc(2026, 3, 30, 7, 0, 0) do
          reminder.schedule_value = 'monday:09:00'
          result = reminder.calculate_next_trigger_at
          expect(result).to eq(Time.utc(2026, 3, 30, 9, 0, 0))
        end
      end

      it 'bumps to the following week when the target weekday has already passed this week' do
        # 2026-03-30 is Monday; "monday" at 08:00 has passed (it is 10:00)
        travel_to Time.utc(2026, 3, 30, 10, 0, 0) do
          reminder.schedule_value = 'monday:08:00'
          result = reminder.calculate_next_trigger_at
          expect(result.to_date).to eq(Date.new(2026, 4, 6))
        end
      end

      it 'advances 7 days from last_triggered_at when after_fire: true' do
        last_fired = Time.utc(2026, 3, 30, 8, 0, 0)
        reminder.schedule_value    = 'monday:08:00'
        reminder.last_triggered_at = last_fired
        result = reminder.calculate_next_trigger_at(after_fire: true)
        expect(result).to eq(last_fired + 7.days)
      end
    end
  end
end
