import { useEffect } from 'react'

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · CatCare` : 'CatCare'
    return () => {
      document.title = 'CatCare'
    }
  }, [title])
}
