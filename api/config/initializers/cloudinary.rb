# Require Cloudinary's Active Storage adapter after ActiveStorage::Blob is defined.
# cloudinary_service.rb calls ActiveStorage::Blob.method_defined? at the top level,
# so requiring it during the initializer phase (before AS loads) causes NameError.
# on_load(:active_storage_blob) defers the require until Blob is fully defined,
# which happens before the service registry is consulted.
ActiveSupport.on_load(:active_storage_blob) do
  require "active_storage/service/cloudinary_service"
end if ENV["CLOUDINARY_URL"].present?
