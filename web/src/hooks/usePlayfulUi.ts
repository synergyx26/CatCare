import { useThemeStore } from '@/store/themeStore'
import { PLAYFUL_UI_AVAILABLE } from '@/lib/featureFlags'

/** True when the playful redesign preview is both built in and chosen by this user. */
export function usePlayfulUi(): boolean {
  const uiStyle = useThemeStore((s) => s.uiStyle)
  return PLAYFUL_UI_AVAILABLE && uiStyle === 'playful'
}
