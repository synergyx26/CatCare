class PushSubscription < ApplicationRecord
  belongs_to :user

  validates :endpoint, :p256dh, :auth, presence: true
  validates :endpoint, uniqueness: true
  validate  :endpoint_is_https

  private

  # Push services are always https; rejecting anything else also stops the
  # server being used to POST to arbitrary internal URLs.
  def endpoint_is_https
    uri = URI.parse(endpoint.to_s)
    errors.add(:endpoint, "must be an https URL") unless uri.is_a?(URI::HTTPS) && uri.host.present?
  rescue URI::InvalidURIError
    errors.add(:endpoint, "is not a valid URL")
  end
end
