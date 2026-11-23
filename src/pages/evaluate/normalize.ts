
import type {
  AnswerDraft,
  Brief,
  ScreenData,
} from '../../types'

function asRecord(
  value: unknown
): Record<string, unknown> | null {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
    ? value as Record<string, unknown>
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : null
}

function asInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value)
    ? value
    : null
}

function readThemes(value: unknown): string {
  if (!Array.isArray(value)) return ''

  const sections: string[] = []

  for (const item of value) {
    const theme = asRecord(item)
    if (!theme) continue

    const title =
      asString(theme.theme) ??
      asString(theme.title) ??
      asString(theme.name)

    const description =
      asString(theme.description) ??
      asString(theme.text) ??
      asString(theme.content)

    if (title && description) {
      sections.push(`${title}\n${description}`)
    } else if (title) {
      sections.push(title)
    } else if (description) {
      sections.push(description)
    }
  }

  return sections.join('\n\n')
}

function readBriefBody(
  entry: Record<string, unknown>
): string | null {
  const directBody =
    asString(entry.body) ??
    asString(entry.text) ??
    asString(entry.content) ??
    asString(entry.brief) ??
    asString(entry.markdown)

  if (directBody) return directBody

  const summary = asString(entry.summary)
  const themes = readThemes(entry.dominant_themes)

  if (!summary && !themes) return null

  const sections: string[] = []

  if (summary) {
    sections.push(`SUMMARY\n${summary}`)
  }

  if (themes) {
    sections.push(`DOMINANT THEMES\n${themes}`)
  }

  return sections.join('\n\n')
}

/**
 * Converts the actual Supabase evaluation-screen response
 * into the existing frontend ScreenData structure.
 *
 * Preserves frozen brief order, anonymous labels,
 * summary content, dominant themes, and saved scores.
 *
 * Returns null when the response cannot be interpreted.
 */
export function normalizeScreen(
  screenNumber: number,
  raw: Record<string, unknown>
): ScreenData | null {
  const pilotFlag = raw.is_pilot ?? raw.isPilot

  const isPilot =
    typeof pilotFlag === 'boolean'
      ? pilotFlag
      : screenNumber <= 3

  const status = asString(raw.status)

  // A completed screen is explicitly saved but is not
  // necessarily finalized until stage submission.
  const finalized =
    status === 'finalized' ||
    status === 'submitted' ||
    raw.finalized === true

  const revisionRaw =
    raw.draft_revision ??
    raw.draftRevision ??
    raw.expected_draft_revision

  const draftRevision = asInt(revisionRaw) ?? 0

  let briefsRaw: unknown[] | null = null

  for (const key of [
    'briefs',
    'items',
    'variants',
    'contents',
  ]) {
    const value = raw[key]

    if (Array.isArray(value) && value.length > 0) {
      briefsRaw = value
      break
    }
  }

  if (
    !briefsRaw &&
    Array.isArray(raw.screen) &&
    raw.screen.length > 0
  ) {
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
      asString(entry.short_label)

    // Do not invent anonymous labels.
    if (!label) return null

    const title =
      asString(entry.title) ??
      asString(entry.heading) ??
      asString(entry.subject)

    const body = readBriefBody(entry)

    if (!body) return null

    briefs.push({
      label,
      title,
      body,
    })

    // Actual backend uses "scores".
    const ratings =
      asRecord(entry.scores) ??
      asRecord(entry.ratings) ??
      asRecord(entry.answer) ??
      asRecord(entry.evaluation)

    const source: Record<string, unknown> =
      ratings ?? entry

    existingAnswers.push({
      label,
      groundedness: asInt(source.groundedness),
      coverage: asInt(source.coverage),
      actionability: asInt(source.actionability),
      comment: asString(source.comment),
    })
  }

  // Preserve the backend's frozen display order.
  // Do not sort briefs by label or model identity.

  let existingPreference: string | null = null

  const prefRaw =
    raw.preference_label ??
    raw.preference ??
    raw.best_brief

  if (typeof prefRaw === 'string') {
    existingPreference = prefRaw
  } else {
    const preferenceRecord = asRecord(prefRaw)

    if (preferenceRecord) {
      existingPreference =
        asString(preferenceRecord.label)
    }
  }

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
