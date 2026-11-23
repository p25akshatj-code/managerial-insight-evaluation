
export type Role = 'rater' | 'researcher'

export interface ScreenRecord {
  screen_number: number
  status?: string | null
  accessible?: boolean | null
  save_revision?: number | null
  draft_revision?: number | null
  has_unsaved_changes?: boolean | null
}

export interface Progress {
  screens: ScreenRecord[]
  next_screen: number | null
  total_screens: number | null
  pilot_approved: boolean | null
  unsaved_screen: number | null
  completed_screens: number | null
}

export interface SourceReview {
  position: number
  rating: number | null
  text: string
}

export interface Brief {
  label: string
  title: string | null
  body: string | null
}

export interface AnswerDraft {
  label: string
  groundedness: number | null
  coverage: number | null
  actionability: number | null
  comment: string | null
}

export interface SaveResult {
  success: boolean
  status?: string
  draft_revision?: number
  explicitly_saved?: boolean
}

export interface ApiError extends Error {
  status: number
  code: string
}

export type ScreenLoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'diagnostic'; message: string }
  | { kind: 'ready'; screen: ScreenData }

export interface ScreenData {
  screenNumber: number
  isPilot: boolean
  status: string | null
  finalized: boolean
  draftRevision: number
  reviews: SourceReview[]
  briefs: Brief[]
  existingAnswers: AnswerDraft[]
  existingPreference: string | null
}
