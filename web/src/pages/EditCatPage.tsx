import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { ApiError, Cat } from '@/types/api'

const schema = z.object({
  name:              z.string().min(1, 'Name is required'),
  breed:             z.string().optional(),
  sex:               z.enum(['unknown', 'male', 'female']),
  sterilized:        z.boolean(),
  birthday:          z.string().optional(),
  microchip_number:  z.string().optional(),
  health_notes:      z.string().optional(),
  care_instructions: z.string().optional(),
  vet_name:          z.string().optional(),
  vet_clinic:        z.string().optional(),
  vet_phone:         z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function EditCatPage() {
  const { householdId, catId } = useParams<{ householdId: string; catId: string }>()
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()

  const fileInputRef               = useRef<HTMLInputElement>(null)
  const [photoFile, setPhotoFile]  = useState<File | null>(null)
  const [photoPreview, setPreview] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cat', householdId, catId],
    queryFn:  () => api.getCat(Number(householdId), Number(catId)),
  })
  const cat: Cat | undefined = data?.data?.data
  usePageTitle(cat ? `Edit ${cat.name}` : '')

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver:      zodResolver(schema),
    values: cat ? {
      name:              cat.name,
      breed:             cat.breed             ?? '',
      sex:               cat.sex,
      sterilized:        cat.sterilized,
      birthday:          cat.birthday          ?? '',
      microchip_number:  cat.microchip_number  ?? '',
      health_notes:      cat.health_notes      ?? '',
      care_instructions: cat.care_instructions ?? '',
      vet_name:          cat.vet_name          ?? '',
      vet_clinic:        cat.vet_clinic        ?? '',
      vet_phone:         cat.vet_phone         ?? '',
    } : undefined,
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const fd = new FormData()
      fd.append('cat[name]',             values.name)
      fd.append('cat[sex]',              values.sex)
      fd.append('cat[sterilized]',       String(values.sterilized))
      if (values.breed)             fd.append('cat[breed]',             values.breed)
      if (values.birthday)          fd.append('cat[birthday]',          values.birthday)
      if (values.microchip_number)  fd.append('cat[microchip_number]',  values.microchip_number)
      if (values.health_notes)      fd.append('cat[health_notes]',      values.health_notes)
      if (values.care_instructions) fd.append('cat[care_instructions]', values.care_instructions)
      if (values.vet_name)          fd.append('cat[vet_name]',          values.vet_name)
      if (values.vet_clinic)        fd.append('cat[vet_clinic]',        values.vet_clinic)
      if (values.vet_phone)         fd.append('cat[vet_phone]',         values.vet_phone)
      if (photoFile)                fd.append('cat[photo]',             photoFile)
      return api.updateCat(Number(householdId), Number(catId), fd)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cat', householdId, catId] })
      queryClient.invalidateQueries({ queryKey: ['cats', Number(householdId)] })
      toast.success('Changes saved!')
      navigate(`/households/${householdId}/cats/${catId}`, { replace: true })
    },
    onError: (err) => {
      const message = (err as AxiosError<ApiError>).response?.data?.message
        ?? 'Something went wrong. Please try again.'
      toast.error(message)
    },
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPreview(URL.createObjectURL(file))
  }

  function clearPhoto() {
    setPhotoFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (isLoading) {
    return <PageSkeleton />
  }

  if (isError || !cat) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-destructive text-sm">Failed to load cat profile.</p>
      </div>
    )
  }

  const currentPhotoSrc = photoPreview ?? cat.photo_url ?? null

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <PageHeader
        title={`Edit ${cat.name}`}
        backTo={{
          label: 'Cancel',
          onClick: () => navigate(`/households/${householdId}/cats/${catId}`),
        }}
      />

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-5">

        {/* Photo */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative group"
            aria-label="Change photo"
          >
            {currentPhotoSrc ? (
              <img
                src={currentPhotoSrc}
                alt={cat.name}
                className="size-24 rounded-full object-cover border"
              />
            ) : (
              <div className="flex size-24 items-center justify-center rounded-full border border-dashed bg-primary/10 text-primary">
                <span className="text-2xl font-semibold">{cat.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <span className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
              Change
            </span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {photoPreview && (
            <button
              type="button"
              onClick={clearPhoto}
              className="text-xs text-muted-foreground underline"
            >
              Remove new photo
            </button>
          )}
        </div>

        {/* Basic identity */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Basic info
          </p>

          <div className="space-y-1">
            <label className="text-sm font-medium">Name *</label>
            <Input {...register('name')} />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Breed</label>
            <Input {...register('breed')} placeholder="e.g. Domestic Shorthair" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Birthday</label>
            <Input {...register('birthday')} type="date" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Sex</label>
            <select {...register('sex')} className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
              <option value="unknown">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              {...register('sterilized')}
              type="checkbox"
              id="sterilized"
              className="h-4 w-4 rounded border-input"
            />
            <label htmlFor="sterilized" className="text-sm">Spayed / neutered</label>
          </div>
        </div>

        {/* Medical & ID */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Medical &amp; ID
          </p>

          <div className="space-y-1">
            <label className="text-sm font-medium">Microchip number</label>
            <Input
              {...register('microchip_number')}
              placeholder="15-digit ISO number"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Health notes</label>
            <Textarea
              {...register('health_notes')}
              placeholder="Known conditions, allergies, current medications, vet contact..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Allergies, ongoing conditions, vet info, current meds.
            </p>
          </div>
        </div>

        {/* Sitter info */}
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Sitter info
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Visible to everyone — fill this in before leaving your cat with a sitter.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Care instructions</label>
            <Textarea
              {...register('care_instructions')}
              placeholder={"Feed twice daily at 7am and 6pm — 80g dry food.\nFresh water every morning.\nPlaytime before bed."}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Feeding schedule, routines, special instructions for sitters.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Vet name</label>
            <Input {...register('vet_name')} placeholder="Dr. Sarah Kim" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Vet clinic</label>
            <Input {...register('vet_clinic')} placeholder="Eastside Animal Hospital" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Vet phone</label>
            <Input {...register('vet_phone')} type="tel" placeholder="(555) 123-4567" />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Save changes'}
        </Button>
      </form>
    </div>
  )
}
