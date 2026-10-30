import { useThemeStore } from '@/store/themeStore'
import { SIDEBAR_NAV_AVAILABLE } from '@/lib/featureFlags'

/** True when the sidebar navigation preview is both built in and chosen by this user. */
export function useSidebarNav(): boolean {
  const navStyle = useThemeStore((s) => s.navStyle)
  return SIDEBAR_NAV_AVAILABLE && navStyle === 'sidebar'
}
