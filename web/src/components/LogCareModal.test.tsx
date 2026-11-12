// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Cat } from '@/types/api'

vi.mock('@/api/client', () => ({
  api: {
    createCareEvent: vi.fn(() => Promise.resolve({ data: { data: {} } })),
    updateCareEvent: vi.fn(),
    deleteCareEvent: vi.fn(),
    getHouseholds: vi.fn(() => Promise.resolve({ data: { data: [] } })),
  },
}))
vi.mock('@/hooks/useEffectiveTier', () => ({ useEffectiveTier: () => 'premium' }))

import { LogCareModal } from './LogCareModal'
import { api } from '@/api/client'

const cat = { id: 7, name: 'Miso', household_id: 1, feeding_presets: null } as unknown as Cat

function renderModal(props: Partial<React.ComponentProps<typeof LogCareModal>> = {}) {
  const onClose = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <LogCareModal cat={cat} householdId={1} onClose={onClose} {...props} />
    </QueryClientProvider>,
  )
  return { onClose }
}

describe('LogCareModal — logging a due medication dose', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('shows a summary instead of editable fields, and focuses no text input', () => {
    renderModal({
      initialType: 'medication',
      initialMedicationName: 'Prednisolone',
      initialMedicationDosage: '5',
      initialMedicationUnit: 'mg',
    })
    expect(screen.getByText('Prednisolone')).toBeTruthy()
    expect(screen.getByText('5 mg')).toBeTruthy()
    expect(screen.queryByLabelText(/Medication name/i)).toBeNull()
    expect(screen.queryByLabelText(/Track as ongoing/i)).toBeNull()
    expect(document.activeElement?.tagName).not.toBe('INPUT')
  })

  it('logs the dose with one click and no edits (a dose, not a regimen start)', async () => {
    const { onClose } = renderModal({
      initialType: 'medication',
      initialMedicationName: 'Prednisolone',
      initialMedicationDosage: '5',
      initialMedicationUnit: 'mg',
    })
    await userEvent.click(screen.getByRole('button', { name: 'Log medication' }))

    await waitFor(() => expect(api.createCareEvent).toHaveBeenCalledTimes(1))
    const [householdId, body] = (api.createCareEvent as ReturnType<typeof vi.fn>).mock.calls[0] as [number, { care_event: Record<string, unknown> }]
    expect(householdId).toBe(1)
    expect(body.care_event).toMatchObject({
      cat_id: 7,
      event_type: 'medication',
      details: { medication_name: 'Prednisolone', dosage: '5', unit: 'mg' },
    })
    expect(body.care_event.details).not.toHaveProperty('active_medication')
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('works for a regimen without a dosage', async () => {
    renderModal({ initialType: 'medication', initialMedicationName: 'Fish oil' })
    await userEvent.click(screen.getByRole('button', { name: 'Log medication' }))
    await waitFor(() => expect(api.createCareEvent).toHaveBeenCalledTimes(1))
    const body = (api.createCareEvent as ReturnType<typeof vi.fn>).mock.calls[0][1] as { care_event: { details: Record<string, unknown> } }
    expect(body.care_event.details).toEqual({ medication_name: 'Fish oil' })
  })

  it('keeps the full form (name field focused) when adding a new medication manually', () => {
    renderModal({ initialType: 'medication' })
    const name = screen.getByLabelText(/Medication name/i)
    expect(name).toBeTruthy()
    expect(document.activeElement).toBe(name)
  })

  it('keeps the full form when starting a tracked regimen with a prefilled name', () => {
    renderModal({ initialType: 'medication', initialMedicationName: 'Prednisolone', activeMedication: true })
    expect(screen.getByLabelText(/Medication name/i)).toBeTruthy()
  })
})
