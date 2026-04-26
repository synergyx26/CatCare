import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Allows: import { Button } from "@/components/ui/button"
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Mirror the security headers from public/_headers so dev behaviour
    // matches production and CSP violations surface locally.
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '0',
      'X-Download-Options': 'noopen',
      'X-Permitted-Cross-Domain-Policies': 'none',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy':
        'geolocation=(), microphone=(), camera=(), payment=(), usb=(), ' +
        'magnetometer=(), gyroscope=(), accelerometer=(), display-capture=()',
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      // Dev uses http://localhost so upgrade-insecure-requests is omitted here.
      'Content-Security-Policy':
        "default-src 'none'; " +
        "script-src 'self' https://accounts.google.com https://apis.google.com; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' https: blob: data:; " +
        "font-src 'self' data:; " +
        "connect-src 'self' https://catcare-v52y.onrender.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://accounts.google.com ws: wss:; " +
        "frame-src https://accounts.google.com; " +
        "frame-ancestors 'none'; " +
        "form-action 'self'; " +
        "base-uri 'self'; " +
        "object-src 'none'",
    },
  },
})
