import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Request interceptor: attach JWT from localStorage ───────────────────────
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('catcare_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── Response interceptor: extract token, handle 401 ─────────────────────────
apiClient.interceptors.response.use(
  (response) => {
    // devise-jwt sends the token in the Authorization response header
    const token = response.headers['authorization']?.replace('Bearer ', '')
    if (token) {
      localStorage.setItem('catcare_token', token)
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('catcare_token')
      // Redirect to login — covers expired tokens, revoked tokens, etc.
      window.location.href = '/login'
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

  forgotPassword: (email: string) =>
    apiClient.post('/passwords', { email }),

  resetPassword: (token: string, password: string, passwordConfirmation: string) =>
    apiClient.patch(`/passwords/${token}`, { password, password_confirmation: passwordConfirmation }),

  // Households
  getHouseholds: () =>
    apiClient.get('/households'),

  createHousehold: (data: { household: { name: string } }) =>
    apiClient.post('/households', data),

  updateHousehold: (id: number, data: { household: { name?: string; emergency_contact_name?: string | null; emergency_contact_phone?: string | null; vet_name?: string | null; vet_clinic?: string | null; vet_phone?: string | null; vet_address?: string | null } }) =>
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

  updateCatCareRequirements: (
    householdId: number,
    catId: number,
    data: {
      cat: {
        feedings_per_day?: number
        track_water?: boolean
        track_litter?: boolean
        feeding_presets?: { wet: number[]; dry: number[]; treats: number[]; other: number[] }
      }
    }
  ) => apiClient.patch(`/households/${householdId}/cats/${catId}`, data),

  getCat: (householdId: number, catId: number) =>
    apiClient.get(`/households/${householdId}/cats/${catId}`),

  getCatStats: (householdId: number, catId: number, range: '7d' | '30d' | '90d' = '30d') =>
    apiClient.get(`/households/${householdId}/cats/${catId}/stats`, { params: { range } }),

  // Care events
  getCareEvents: (householdId: number, options?: { catId?: number; upcoming?: boolean; eventTypes?: string[] }) => {
    const params: Record<string, unknown> = {}
    if (options?.catId) params.cat_id = options.catId
    if (options?.upcoming) params.upcoming = true
    if (options?.eventTypes?.length) params['event_types[]'] = options.eventTypes
    return apiClient.get(`/households/${householdId}/care_events`, { params })
  },

  createCareEvent: (householdId: number, data: Record<string, unknown>) =>
    apiClient.post(`/households/${householdId}/care_events`, data),

  updateCareEvent: (householdId: number, eventId: number, data: Record<string, unknown>) =>
    apiClient.patch(`/households/${householdId}/care_events/${eventId}`, data),

  deleteCareEvent: (householdId: number, eventId: number) =>
    apiClient.delete(`/households/${householdId}/care_events/${eventId}`),

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
}
