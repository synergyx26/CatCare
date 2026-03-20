import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant: 'archive' | 'deceased'
  catName: string
  onConfirm: () => void
  isPending?: boolean
}

const COPY = {
  archive: {
    title: (name: string) => `Archive ${name}?`,
    description:
      'This cat will be removed from the active dashboard. You can restore them any time from the archived section.',
    confirm: 'Archive',
    confirmClass: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  deceased: {
    title: (name: string) => `Mark ${name} as deceased?`,
    description:
      "We're so sorry for your loss. This will move them to the archived section as a memorial. Their care history will be preserved.",
    confirm: 'Mark as deceased',
    confirmClass: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
  },
}

export function ArchiveConfirmDialog({
  open,
  onOpenChange,
  variant,
  catName,
  onConfirm,
  isPending,
}: Props) {
  const copy = COPY[variant]

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title(catName)}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={copy.confirmClass}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Saving...' : copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
