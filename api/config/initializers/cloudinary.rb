# Explicitly require Cloudinary's Active Storage adapter.
# The cloudinary gem v2.x does not auto-register its ActiveStorage::Service::CloudinaryService
# in Rails 8 because ActiveStorage may not yet be defined when the gem is first required.
# Loading it here (after all engines are initialized) ensures the service class is
# registered before Active Storage's eager-load hook tries to look it up.
require "active_storage/service/cloudinary_service" if ENV["CLOUDINARY_URL"].present?
