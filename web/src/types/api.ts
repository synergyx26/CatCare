// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  email: string
  name: string
  created_at?: string
}

export interface AuthResponse {
  data: User
}

// ─── Households ───────────────────────────────────────────────────────────────

export type MemberRole = 'member' | 'admin' | 'sitter'

export interface HouseholdMember {
  id: number
  name: string
  role: MemberRole
  membership_id: number
}

export interface Household {
  id: number
  name: string
  created_by: number
  member_count: number
  members: HouseholdMember[]
  cat_count: number
  created_at: string
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  vet_name: string | null
  vet_clinic: string | null
  vet_phone: string | null
  vet_address: string | null
}

export interface MembershipProfile {
  id: number
  user_id: number
  household_id: number
  role: MemberRole
  phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  notes: string | null
}

export interface HouseholdInvite {
  id: number
  email: string
  token: string
  status: 'pending' | 'accepted' | 'expired'
  role: 'member' | 'sitter'
  invited_by: string
  expires_at: string
  created_at: string
}

export interface InviteDetails {
  token: string
  household_name: string
  invited_by: string
  email: string
  expires_at: string
}

// ─── Cats ────────────────────────────────────────────────────────────────────

export type CatSpecies = 'cat' | 'dog' | 'rabbit' | 'bird' | 'fish' | 'other'
export type CatSex = 'unknown' | 'male' | 'female'

export interface Cat {
  id: number
  household_id: number
  name: string
  species: CatSpecies
  sex: CatSex
  sterilized: boolean
  birthday: string | null
  breed: string | null
  microchip_number: string | null
  health_notes: string | null
  active: boolean
  deceased: boolean
  created_by: number
  photo_url: string | null
  vet_name: string | null
  vet_clinic: string | null
  vet_phone: string | null
  vet_address: string | null
  care_instructions: string | null
  feedings_per_day: number
  track_water: boolean
  track_litter: boolean
  feeding_presets: { wet: number[]; dry: number[]; treats: number[]; other: number[] }
  created_at: string
  updated_at: string
}

// ─── Care Events ──────────────────────────────────────────────────────────────

export type EventType =
  | 'feeding' | 'litter' | 'water' | 'weight'
  | 'note' | 'medication' | 'vet_visit' | 'grooming'

// details JSONB shapes per event_type:
//   feeding:    { food_type: 'wet'|'dry'|'treats'|'other', amount_grams?: number }
//   weight:     { weight_value: number, weight_unit: 'kg'|'g' }
//   medication: { medication_name: string, dosage?: string, unit?: 'mg'|'ml'|'tablet' }
//   vet_visit:  { reason: string, vet_name?: string, vet_clinic?: string }
//   grooming:   { grooming_type: 'bath'|'nail_trim'|'full_groom'|'other' }
//   litter / water / note: {}
export interface CareEvent {
  id: number
  cat_id: number
  household_id: number
  logged_by_id: number
  event_type: EventType
  occurred_at: string
  notes: string | null
  details: Record<string, unknown>
  created_at: string
}

// ─── API envelope ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  meta?: Record<string, unknown>
}

export interface ApiError {
  error: string
  message: string
}

// ─── Care Notes ───────────────────────────────────────────────────────────────

export type CareNoteCategory =
  | 'feeding' | 'litter' | 'supplies' | 'home' | 'medical' | 'general'

export interface CareNote {
  id: number
  household_id: number
  cat_id: number | null      // null = household-level note
  created_by_id: number
  created_by: string
  category: CareNoteCategory
  title: string
  body: string
  position: number
  created_at: string
  updated_at: string
}

// ─── Cat Stats ────────────────────────────────────────────────────────────────

export interface DayStats {
  date: string
  count: number
  types: Partial<Record<EventType, number>>
}

export interface WeightPoint {
  occurred_at: string
  value: number
  unit: string
}

export interface MemberStats {
  user_id: number
  name: string
  count: number
}

export interface CatStats {
  range: '7d' | '30d' | '90d'
  start_date: string
  end_date: string
  total_events: number
  by_type: Partial<Record<EventType, number>>
  by_day: DayStats[]
  weight_series: WeightPoint[]
  by_member: MemberStats[]
}
