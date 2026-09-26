// Build-time feature flags. Vite bakes these in at `npm run build`, so a flag
// only changes by rebuilding with a different .env.production.

// Opt-in preview of the "playful" dashboard redesign (animated cats, warm
// palette, card motion). When true, a toggle appears in the nav so each user
// can switch between the classic and playful look on their own device. Set
// only on the self-hosted Proxmox build (proxmox-homelab
// scripts/deploy-catcare.sh); leave unset on Vercel so the online deployment
// keeps the classic UI with no toggle.
export const PLAYFUL_UI_AVAILABLE = import.meta.env.VITE_PLAYFUL_UI_ENABLED === 'true'
