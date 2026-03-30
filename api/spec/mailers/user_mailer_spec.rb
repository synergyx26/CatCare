require 'rails_helper'

RSpec.describe UserMailer, type: :mailer do
  describe '#reminder_notification' do
    let(:household) { create(:household) }
    let(:user)      { create(:user) }
    let(:cat)       { create(:cat, household: household) }
    let(:reminder) do
      create(:reminder,
        cat:           cat,
        household:     household,
        care_type:     :feeding,
        schedule_type: :daily,
        schedule_value: '08:00')
    end

    subject(:mail) { described_class.reminder_notification(reminder, user, cat) }

    it 'sends to the correct recipient' do
      expect(mail.to).to eq([user.email])
    end

    it 'includes [CatCare] prefix in subject' do
      expect(mail.subject).to start_with('[CatCare]')
    end

    it 'includes the cat name in the subject' do
      expect(mail.subject).to include(cat.name)
    end

    it 'includes the care type in the subject' do
      expect(mail.subject).to include('Feeding')
    end

    it 'includes the user name in the HTML body' do
      expect(mail.html_part.body.decoded).to include(user.name)
    end

    it 'includes the cat name in the HTML body' do
      expect(mail.html_part.body.decoded).to include(cat.name)
    end

    it 'includes the dashboard URL in the HTML body' do
      expect(mail.html_part.body.decoded).to include('/dashboard')
    end

    it 'includes the settings URL in the HTML body' do
      expect(mail.html_part.body.decoded).to include('/notification-settings')
    end

    it 'renders a text part' do
      expect(mail.text_part.body.decoded).to include(user.name)
      expect(mail.text_part.body.decoded).to include(cat.name)
    end
  end
end
