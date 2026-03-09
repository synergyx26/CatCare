class Rack::Attack
  # Throttle login attempts: 5 per minute per IP
  throttle("logins/ip", limit: 5, period: 1.minute) do |req|
    req.ip if req.path == "/api/v1/sessions" && req.post?
  end

  # Throttle registration attempts: 3 per hour per IP
  throttle("registrations/ip", limit: 3, period: 1.hour) do |req|
    req.ip if req.path == "/api/v1/registrations" && req.post?
  end

  # General API throttle: 300 requests per 5 minutes per IP
  throttle("api/ip", limit: 300, period: 5.minutes) do |req|
    req.ip if req.path.start_with?("/api/")
  end
end
