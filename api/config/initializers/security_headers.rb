# OWASP-aligned HTTP security headers applied to every API response.
#
# Why a separate initializer rather than production.rb:
# - Development and test benefit from the same headers so local curl/browser
#   testing reflects production behaviour.
# - config.action_dispatch.default_headers is the Rails-idiomatic approach;
#   no extra gem required.
#
# X-XSS-Protection is intentionally set to "0". OWASP now recommends disabling
# the legacy browser XSS auditor because it can introduce its own vulnerabilities
# (XSS-Auditor bypass + reflected-file-download). CSP is the real defence.

Rails.application.config.action_dispatch.default_headers = {
  # Clickjacking — prevent this API from being framed anywhere
  "X-Frame-Options"                   => "DENY",

  # MIME sniffing — browsers must honour the declared Content-Type
  "X-Content-Type-Options"            => "nosniff",

  # Legacy XSS auditor — disabled per OWASP guidance; rely on CSP instead
  "X-XSS-Protection"                  => "0",

  # IE-specific — prevent document downloads from being opened in IE
  "X-Download-Options"                => "noopen",

  # Flash / cross-domain policy files — block entirely (no Flash used)
  "X-Permitted-Cross-Domain-Policies" => "none",

  # Referrer — send origin only on cross-origin HTTPS requests; nothing on downgrade
  "Referrer-Policy"                   => "strict-origin-when-cross-origin",

  # Permissions — disable every browser feature this API doesn't need
  "Permissions-Policy"                => "geolocation=(), microphone=(), camera=(), " \
                                         "payment=(), usb=(), magnetometer=(), " \
                                         "gyroscope=(), accelerometer=(), display-capture=()",

  # CSP — this is an API-only app; no HTML is executed, so a tight deny-all
  # policy is safe and prevents any accidental content injection.
  # frame-ancestors 'none' blocks embedding (supersedes X-Frame-Options in modern browsers).
  "Content-Security-Policy"           => "default-src 'none'; frame-ancestors 'none'; " \
                                         "form-action 'none'",
}
