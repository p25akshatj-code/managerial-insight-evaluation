import type { ApiError } from '../types'
import { supabase, EDGE_FUNCTION_URL } from './supabase'

function makeApiError(status: number, message: string, code: string): ApiError {
  const err = new Error(message) as ApiError
  err.status = status
  err.code = code
  return err
}

async function callEdgeFunction<T>(body: Record<string, unknown>): Promise<{ status: number; data: T }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (!token) {
    throw makeApiError(401, 'Your session has expired. Please sign in again.', 'session_expired')
  }

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: JSON.stringify(body),
  })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    // non-JSON body
  }

  if (!response.ok) {
    const record = (payload ?? {}) as Record<string, unknown>
    const code = typeof record.error === 'string' ? record.error : typeof record.code === 'string' ? record.code : `http_${response.status}`
    const messages: Record<number, string> = {
      400: 'The request was invalid. Please try again.',
      401: 'Your session has expired. Please sign in again.',
      403: 'You are not authorized to perform this action.',
      409: 'Your ratings on this screen are out of date with the server.',
      422: 'The evaluation was incomplete or invalid.',
      503: 'Evaluation submissions are not yet open. Your ratings cannot be submitted at this time.',
    }
    throw makeApiError(response.status, messages[response.status] ?? 'An unexpected error occurred.', code)
  }

  return { status: response.status, data: payload as T }
}

export async function checkAccess(): Promise<'rater' | 'researcher' | null> {
  const { data } = await callEdgeFunction<{ authenticated: boolean; role?: string }>({ operation: 'access' })
  if (data && data.authenticated && (data.role === 'rater' || data.role === 'researcher')) {
    return data.role
  }
  return null
}

export interface ProgressResult {
  screens: Array<{
    screen_number: number
    status?: string | null
    accessible?: boolean | null
    save_revision?: number | null
    draft_revision?: number | null
    has_unsaved_changes?: boolean | null
  }>
  next_screen: number | null
  total_screens: number | null
  pilot_approved: boolean | null
  unsaved_screen: number | null
  completed_screens: number | null
}

export async function getProgress(): Promise<ProgressResult> {
  const { data } = await callEdgeFunction<{ progress: ProgressResult }>({ operation: 'progress' })
  if (!data || !data.progress || !Array.isArray(data.progress.screens)) {
    throw makeApiError(0, 'Progress information could not be read from the server.', 'invalid_progress')
  }
  return data.progress
}

export async function getScreen(screenNumber: number): Promise<Record<string, unknown>> {
  const { data } = await callEdgeFunction<{ screen: Record<string, unknown> }>({
    operation: 'screen',
    screen_number: screenNumber,
  })
  if (!data || typeof data.screen !== 'object' || data.screen === null) {
    throw makeApiError(0, 'The screen content could not be read from the server.', 'invalid_screen')
  }
  return data.screen
}

export async function getInitialPilotScreen(): Promise<Record<string, unknown>> {
  const { data } = await callEdgeFunction<{ screen: Record<string, unknown> }>({ operation: 'initial_pilot_screen' })
  if (!data || typeof data.screen !== 'object' || data.screen === null) {
    throw makeApiError(0, 'The screen content could not be read from the server.', 'invalid_screen')
  }
  return data.screen
}

export interface AutosaveArgs {
  screenNumber: number
  expectedDraftRevision: number
  answers: Array<{ label: string; groundedness?: number; coverage?: number; actionability?: number; comment?: string }>
  preferenceLabel: string | null
}

export async function autosave(args: AutosaveArgs): Promise<{ success: boolean; draft_revision: number }> {
  const body: Record<string, unknown> = {
    operation: 'autosave',
    screen_number: args.screenNumber,
    expected_draft_revision: args.expectedDraftRevision,
    answers: args.answers,
    preference_label: args.preferenceLabel,
  }
  const { data } = await callEdgeFunction<{ result: { success: boolean; draft_revision: number } }>(body)
  if (!data?.result?.success) {
    throw makeApiError(0, 'Autosave did not succeed.', 'autosave_failed')
  }
  return data.result
}

export interface SaveArgs extends AutosaveArgs {}

export async function saveScreen(args: SaveArgs): Promise<{ success: boolean; status: string; draft_revision: number; explicitly_saved: boolean }> {
  const body: Record<string, unknown> = {
    operation: 'save',
    screen_number: args.screenNumber,
    expected_draft_revision: args.expectedDraftRevision,
    answers: args.answers,
    preference_label: args.preferenceLabel,
  }
  const { data } = await callEdgeFunction<{ result: { success: boolean; status: string; draft_revision: number; explicitly_saved: boolean } }>(body)
  if (!data?.result?.success) {
    throw makeApiError(0, 'Saving did not succeed.', 'save_failed')
  }
  return data.result
}

export async function submitStage(stage: 'pilot' | 'main'): Promise<void> {
  const { data } = await callEdgeFunction<{ result: { success: boolean } }>({ operation: 'submit_stage', stage })
  if (!data?.result?.success) {
    throw makeApiError(0, 'Submission did not succeed.', 'submit_failed')
  }
}

export async function approvePilot(raterId: string): Promise<void> {
  const { data } = await callEdgeFunction<{ result: { success: boolean } }>({ operation: 'approve_pilot', rater_id: raterId })
  if (!data?.result?.success) {
    throw makeApiError(0, 'Approval did not succeed.', 'approve_failed')
  }
}

export { makeApiError }
