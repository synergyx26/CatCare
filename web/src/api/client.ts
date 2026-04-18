import axios from 'axios'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import type { NotificationPreferences, ImportCareEventRow, ExpenseRange, PetExpense } from '@/types/api'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
})

// ─── Request interceptor: attach JWT from localStorage ───────────────────────
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('catcare_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // For FormData, remove the default Content-Type so the browser can set
  // multipart/form-data with the correct boundary automatically.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

// ─── Response interceptor: extract token, handle 401, cold-start retry ───────
apiClient.interceptors.response.use(
  (response) => {
    // devise-jwt sends the token in the Authorization response header
    const token = response.headers['authorization']?.replace('Bearer ', '')
    if (token) {
      localStorage.setItem('catcare_token', token)
    }
    // Dismiss the cold-start toast if a request eventually succeeds
    toast.dismiss('cold-start')
    return response
  },
  async (error) => {
    if (error.response?.status === 401) {
      // Clear all auth state so Zustand + localStorage are consistent on reload
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // Cold-start retry: Render free tier spins down after inactivity. When
    // waking up, the reverse proxy is ready before Puma, so all requests get
    // 502 for ~60–90 seconds. Retry with backoff and notify the user.
    const status = error.response?.status
    if ((status === 502 || status === 503 || status === 504) && error.config) {
      const config = error.config as typeof error.config & { _retryCount?: number }
      const retryCount = config._retryCount ?? 0
      const maxRetries = 8

      if (retryCount < maxRetries) {
        config._retryCount = retryCount + 1

        if (retryCount === 0) {
          toast.loading('Server is starting up, please wait…', {
            id: 'cold-start',
            duration: Infinity,
          })
        }

        // Backoff: 3s, 5s, 7s … capped at 15s
        const delay = Math.min(3000 + retryCount * 2000, 15000)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return apiClient(config)
      }

      toast.dismiss('cold-start')
      toast.error('Server is unavailable. Please try again in a moment.')
    }

    return Promise.reject(error)
  }
)

// ─── Typed helpers ────────────────────────────────────────────────────────────
export const api = {
  // Auth
  register: (data: { user: { name: string; email: string; password: string; password_confirmation: string } }) =>
    apiClient.post('/registrations', data),

  login: (data: { user: { email: string; password: string } }) =>
    apiClient.post('/sessions', data),

  googleOAuth: (credential: string) =>
    apiClient.post('/auth/google', { credential }),

  logout: () =>
    apiClient.delete('/sessions'),

  me: () =>
    apiClient.get('/me'),

  updateSubscriptionTier: (tier: string) =>
    apiClient.patch('/me/subscription_tier', { subscription_tier: tier }),

  forgotPassword: (email: string) =>
    apiClient.post('/passwords', { email }),

  resetPassword: (token: string, password: string, passwordConfirmation: string) =>
    apiClient.patch(`/passwords/${token}`, { password, password_confirmation: passwordConfirmation }),

  // Households
  getHouseholds: () =>
    apiClient.get('/households'),

  createHousehold: (data: { household: { name: string } }) =>
    apiClient.post('/households', data),

  updateHousehold: (id: number, data: { household: { name?: string; currency?: string; default_country?: string; emergency_contact_name?: string | null; emergency_contact_phone?: string | null; vet_name?: string | null; vet_clinic?: string | null; vet_phone?: string | null; vet_address?: string | null } }) =>
    apiClient.patch(`/households/${id}`, data),

  getHousehold: (id: number) =>
    apiClient.get(`/households/${id}`),

  // Membership profile
  getMembership: (householdId: number) =>
    apiClient.get(`/households/${householdId}/membership`),

  updateMembership: (householdId: number, data: {
    membership: {
      phone?: string | null
      emergency_contact_name?: string | null
      emergency_contact_phone?: string | null
      notes?: string | null
    }
  }) =>
    apiClient.patch(`/households/${householdId}/membership`, data),

  // Cats
  getCats: (householdId: number) =>
    apiClient.get(`/households/${householdId}/cats`),

  getArchivedCats: (householdId: number) =>
    apiClient.get(`/households/${householdId}/cats`, { params: { include_inactive: true } }),

  createCat: (householdId: number, data: FormData | Record<string, unknown>) =>
    apiClient.post(`/households/${householdId}/cats`, data),

  updateCat: (householdId: number, catId: number, data: FormData) =>
    apiClient.patch(`/households/${householdId}/cats/${catId}`, data),

  updateCatContacts: (householdId: number, catId: number, data: { cat: { vet_name?: string | null; vet_clinic?: string | null; vet_phone?: string | null; vet_address?: string | null } }) =>
    apiClient.patch(`/households/${householdId}/cats/${catId}`, data),

  updateCatCareRequirements: (
    householdId: number,
    catId: number,
    data: {
      cat: {
        feedings_per_day?: number
        track_toothbrushing?: boolean
        feeding_presets?: { wet: number[]; dry: number[]; treats: number[]; other: number[] }
      }
    }
  ) => apiClient.patch(`/households/${householdId}/cats/${catId}`, data),

  getCat: (householdId: number, catId: number) =>
    apiClient.get(`/households/${householdId}/cats/${catId}`),

  getCatStats: (householdId: number, catId: number, range: '7d' | '30d' | '90d' = '30d', offset = 0) =>
    apiClient.get(`/households/${householdId}/cats/${catId}/stats`, { params: { range, offset } }),

  // Care events
  getCareEvents: (householdId: number, options?: {
    catId?: number
    upcoming?: boolean
    eventTypes?: string[]
    startDate?: string
    endDate?: string
    loggedById?: number
  }) => {
    const params: Record<string, unknown> = {}
    if (options?.catId) params.cat_id = options.catId
    if (options?.upcoming) params.upcoming = true
    if (options?.eventTypes?.length) params['event_types[]'] = options.eventTypes
    if (options?.startDate) params.start_date = options.startDate
    if (options?.endDate) params.end_date = options.endDate
    if (options?.loggedById) params.logged_by_id = options.loggedById
    return apiClient.get(`/households/${householdId}/care_events`, { params })
  },

  createCareEvent: (householdId: number, data: Record<string, unknown>) =>
    apiClient.post(`/households/${householdId}/care_events`, data),

  updateCareEvent: (householdId: number, eventId: number, data: Record<string, unknown>) =>
    apiClient.patch(`/households/${householdId}/care_events/${eventId}`, data),

  deleteCareEvent: (householdId: number, eventId: number) =>
    apiClient.delete(`/households/${householdId}/care_events/${eventId}`),

  // Household chore definitions (user-customisable chore types)
  getHouseholdChoreDefinitions: (householdId: number) =>
    apiClient.get(`/households/${householdId}/chore_definitions`),

  createHouseholdChoreDefinition: (householdId: number, data: {
    household_chore_definition: { name: string; emoji?: string | null; active?: boolean; position?: number; frequency_per_day?: number; location?: string | null }
  }) =>
    apiClient.post(`/households/${householdId}/chore_definitions`, data),

  updateHouseholdChoreDefinition: (householdId: number, definitionId: number, data: {
    household_chore_definition: { name?: string; emoji?: string | null; active?: boolean; position?: number; frequency_per_day?: number; location?: string | null }
  }) =>
    apiClient.patch(`/households/${householdId}/chore_definitions/${definitionId}`, data),

  deleteHouseholdChoreDefinition: (householdId: number, definitionId: number) =>
    apiClient.delete(`/households/${householdId}/chore_definitions/${definitionId}`),

  // Household chores (logged instances of a chore definition)
  getHouseholdChores: (householdId: number, options?: {
    startDate?: string
    endDate?: string
    loggedById?: number
  }) => {
    const params: Record<string, unknown> = {}
    if (options?.startDate)  params.start_date   = options.startDate
    if (options?.endDate)    params.end_date     = options.endDate
    if (options?.loggedById) params.logged_by_id = options.loggedById
    return apiClient.get(`/households/${householdId}/chores`, { params })
  },

  createHouseholdChore: (householdId: number, data: {
    household_chore: { chore_definition_id: number; occurred_at?: string; notes?: string | null }
  }) =>
    apiClient.post(`/households/${householdId}/chores`, data),

  updateHouseholdChore: (householdId: number, choreId: number, data: {
    household_chore: { occurred_at?: string; notes?: string | null }
  }) =>
    apiClient.patch(`/households/${householdId}/chores/${choreId}`, data),

  deleteHouseholdChore: (householdId: number, choreId: number) =>
    apiClient.delete(`/households/${householdId}/chores/${choreId}`),

  // Batch quick actions
  getBatchActions: (householdId: number) =>
    apiClient.get(`/households/${householdId}/batch_actions`),

  createBatchAction: (householdId: number, data: {
    household_batch_action: {
      label: string
      event_type: string
      details: Record<string, unknown>
      default_notes?: string | null
      position?: number
    }
  }) =>
    apiClient.post(`/households/${householdId}/batch_actions`, data),

  updateBatchAction: (householdId: number, actionId: number, data: {
    household_batch_action: {
      label?: string
      event_type?: string
      details?: Record<string, unknown>
      default_notes?: string | null
      position?: number
    }
  }) =>
    apiClient.patch(`/households/${householdId}/batch_actions/${actionId}`, data),

  deleteBatchAction: (householdId: number, actionId: number) =>
    apiClient.delete(`/households/${householdId}/batch_actions/${actionId}`),

  // Care Notes
  getCareNotes: (householdId: number, params?: { cat_id?: number; category?: string }) =>
    apiClient.get(`/households/${householdId}/care_notes`, { params }),

  createCareNote: (householdId: number, data: {
    care_note: {
      cat_id?: number | null
      category: string
      title: string
      body: string
      position?: number
    }
  }) =>
    apiClient.post(`/households/${householdId}/care_notes`, data),

  updateCareNote: (householdId: number, noteId: number, data: {
    care_note: Partial<{
      category: string
      title: string
      body: string
      position: number
    }>
  }) =>
    apiClient.patch(`/households/${householdId}/care_notes/${noteId}`, data),

  deleteCareNote: (householdId: number, noteId: number) =>
    apiClient.delete(`/households/${householdId}/care_notes/${noteId}`),

  // Reminders
  getReminders: (householdId: number) =>
    apiClient.get(`/households/${householdId}/reminders`),

  createReminder: (householdId: number, data: {
    reminder: {
      cat_id?: number | null
      all_cats?: boolean
      care_type: string
      schedule_type: string
      schedule_value?: string
      notify_all_members?: boolean
    }
  }) =>
    apiClient.post(`/households/${householdId}/reminders`, data),

  updateReminder: (householdId: number, reminderId: number, data: {
    reminder: {
      cat_id?: number | null
      all_cats?: boolean
      care_type?: string
      schedule_type?: string
      schedule_value?: string
    }
  }) =>
    apiClient.patch(`/households/${householdId}/reminders/${reminderId}`, data),

  deleteReminder: (householdId: number, reminderId: number) =>
    apiClient.delete(`/households/${householdId}/reminders/${reminderId}`),

  // Vacation Trips
  getVacationTrips: (householdId: number) =>
    apiClient.get(`/households/${householdId}/vacation_trips`),

  createVacationTrip: (householdId: number, data: {
    vacation_trip: {
      start_date: string
      end_date?: string | null
      notes?: string | null
      sitter_visit_frequency_days: number
    }
  }) =>
    apiClient.post(`/households/${householdId}/vacation_trips`, data),

  updateVacationTrip: (householdId: number, tripId: number, data: {
    vacation_trip: Partial<{
      start_date: string
      end_date: string | null
      notes: string | null
      sitter_visit_frequency_days: number
      active: boolean
    }>
  }) =>
    apiClient.patch(`/households/${householdId}/vacation_trips/${tripId}`, data),

  deleteVacationTrip: (householdId: number, tripId: number) =>
    apiClient.delete(`/households/${householdId}/vacation_trips/${tripId}`),

  testSendReminder: (householdId: number, reminderId: number) =>
    apiClient.post(`/households/${householdId}/reminders/${reminderId}/test_send`),

  // Member management (admin only)
  updateMemberRole: (householdId: number, membershipId: number, role: 'member' | 'admin' | 'sitter') =>
    apiClient.patch(`/households/${householdId}/memberships/${membershipId}`, { membership: { role } }),

  removeMember: (householdId: number, membershipId: number) =>
    apiClient.delete(`/households/${householdId}/memberships/${membershipId}`),

  // Invites
  createInvite: (householdId: number, data: { invite: { email: string; role?: string } }) =>
    apiClient.post(`/households/${householdId}/invites`, data),

  getInvites: (householdId: number) =>
    apiClient.get(`/households/${householdId}/invites`),

  revokeInvite: (householdId: number, inviteId: number) =>
    apiClient.delete(`/households/${householdId}/invites/${inviteId}`),

  getInvite: (token: string) =>
    apiClient.get(`/invites/${token}`),

  acceptInvite: (token: string) =>
    apiClient.post(`/invites/${token}/accept`),

  updateNotificationPreferences: (prefs: Partial<NotificationPreferences>) =>
    apiClient.patch('/me/notification_preferences', { notification_preferences: prefs }),

  // Super-admin
  adminStats: () =>
    apiClient.get('/admin/stats'),

  adminUsers: (params?: { page?: number; per?: number; search?: string; tier?: string }) =>
    apiClient.get('/admin/users', { params }),

  adminUpdateUserTier: (userId: number, tier: string) =>
    apiClient.patch(`/admin/users/${userId}`, { subscription_tier: tier }),

  adminImportCareEvents: (events: ImportCareEventRow[]) =>
    apiClient.post('/admin/imports/care_events', { events }, { timeout: 120_000 }),

  // ─── Pet Expenses (Premium) ────────────────────────────────────────────────

  getExpenses: (
    householdId: number,
    opts?: { range?: ExpenseRange; catId?: number; category?: string; dateFrom?: string; dateTo?: string }
  ) => {
    const params: Record<string, unknown> = {}
    if (opts?.range)    params.range    = opts.range
    if (opts?.catId)    params.cat_id   = opts.catId
    if (opts?.category) params.category = opts.category
    if (opts?.dateFrom) params.date_from = opts.dateFrom
    if (opts?.dateTo)   params.date_to   = opts.dateTo
    return apiClient.get(`/households/${householdId}/expenses`, { params })
  },

  createExpense: (
    householdId: number,
    data: {
      pet_expense: Omit<PetExpense, 'id' | 'household_id' | 'created_by_id' | 'total_cost' | 'created_at'>
    }
  ) =>
    apiClient.post(`/households/${householdId}/expenses`, data),

  updateExpense: (
    householdId: number,
    expenseId: number,
    data: { pet_expense: Partial<Omit<PetExpense, 'id' | 'household_id' | 'created_by_id' | 'total_cost' | 'created_at'>> }
  ) =>
    apiClient.patch(`/households/${householdId}/expenses/${expenseId}`, data),

  deleteExpense: (householdId: number, expenseId: number) =>
    apiClient.delete(`/households/${householdId}/expenses/${expenseId}`),

  getExpenseStats: (householdId: number, range: ExpenseRange = '1m') =>
    apiClient.get(`/households/${householdId}/expenses/stats`, { params: { range } }),
}
