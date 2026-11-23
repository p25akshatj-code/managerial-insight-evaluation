import type { AnswerDraft, Brief, ScreenData } from '../../types'

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function asInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

/**
 * The exact JSON shape of the screen response is not fixed, so this
 * normalization accepts several plausible layouts and fails loudly
 * (returns null) when no brief content can be found. It never invents content.
 */
export function normalizeScreen(screenNumber: number, raw: Record<string, unknown>): ScreenData | null {
  const pilotFlag = raw.is_pilot ?? raw.isPilot
  const isPilot = typeof pilotFlag === 'boolean' ? pilotFlag : screenNumber <= 3

  const status = asString(raw.status)
  const finalized = status === 'completed' || status === 'finalized' || status === 'submitted' || raw.finalized === true

  const revisionRaw = raw.draft_revision ?? raw.draftRevision ?? raw.expected_draft_revision
  const draftRevision = asInt(revisionRaw) ?? 0

  let briefsRaw: unknown[] | null = null
  for (const key of ['briefs', 'items', 'variants', 'contents']) {
    const value = raw[key]
    if (Array.isArray(value) && value.length > 0) {
      briefsRaw = value
      break
    }
  }
  if (!briefsRaw && Array.isArray(raw.screen) && raw.screen.length > 0) {
    briefsRaw = raw.screen
  }

  if (!briefsRaw) return null

  const briefs: Brief[] = []
  const existingAnswers: AnswerDraft[] = []

  for (let i = 0; i < briefsRaw.length; i++) {
    const entry = asRecord(briefsRaw[i])
    if (!entry) return null

    const label =
      asString(entry.label) ??
      asString(entry.variant_label) ??
      asString(entry.short_label) ??
      String.fromCharCode(65 + i)
    const title = asString(entry.title) ?? asString(entry.heading) ?? asString(entry.subject)
    const body =
      asString(entry.body) ??
      asString(entry.text) ??
      asString(entry.content) ??
      asString(entry.brief) ??
      asString(entry.markdown) ??
      null

    if (body === null) return null

    briefs.push({ label, title, body })

    const ratings = asRecord(entry.ratings) ?? asRecord(entry.answer) ?? asRecord(entry.evaluation)
    const source: Record<string, unknown> = ratings ?? entry
    existingAnswers.push({
      label,
      groundedness: asInt(source.groundedness),
      coverage: asInt(source.coverage),
      actionability: asInt(source.actionability),
      comment: asString(source.comment),
    })
  }

  let existingPreference: string | null = null
  const prefRaw = raw.preference_label ?? raw.preference ?? raw.best_brief
  if (typeof prefRaw === 'string') existingPreference = prefRaw
  else if (asRecord(prefRaw)?.label) existingPreference = asString(asRecord(prefRaw)!.label)

  return {
    screenNumber,
    isPilot,
    status,
    finalized,
    draftRevision,
    briefs,
    existingAnswers,
    existingPreference,
  }
}
