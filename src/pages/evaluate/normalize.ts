
import type {
  AnswerDraft,
  Brief,
  ScreenData,
  SourceReview,
} from '../../types'

function record(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim()
    ? value
    : null
}

function int(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isInteger(value)
    ? value
    : null
}

function readBriefBody(entry: Record<string, unknown>): string | null {
  const sections: string[] = []

  const summary = str(entry.summary)
  if (summary) {
    sections.push(`SUMMARY\n${summary}`)
  }

  if (Array.isArray(entry.dominant_themes)) {
    const themes = entry.dominant_themes.map((value) => {
      const item = record(value)
      if (!item) return ''
      const title = str(item.theme) ?? ''
      const description = str(item.description) ?? ''
      return [title, description].filter(Boolean).join('\n')
    }).filter(Boolean)

    if (themes.length) {
      sections.push(`DOMINANT THEMES\n${themes.join('\n\n')}`)
    }
  }

  if (Array.isArray(entry.dissatisfaction_drivers)) {
    const drivers = entry.dissatisfaction_drivers
      .map((value) => str(value))
      .filter((value): value is string => value !== null)

    if (drivers.length) {
      sections.push(
        `DISSATISFACTION DRIVERS\n${drivers
          .map((value, i) => `${i + 1}. ${value}`)
          .join('\n\n')}`
      )
    }
  }

  if (Array.isArray(entry.recommendations)) {
    const recommendations = entry.recommendations
      .map((value) => {
        const item = record(value)
        if (!item) return ''

        const priority = int(item.priority)
        const recommendation = str(item.recommendation)
        const rationale = str(item.rationale)

        return [
          priority !== null ? `Priority ${priority}` : '',
          recommendation ?? '',
          rationale ? `Rationale: ${rationale}` : '',
        ].filter(Boolean).join('\n')
      })
      .filter(Boolean)

    if (recommendations.length) {
      sections.push(
        `RECOMMENDATIONS\n${recommendations.join('\n\n')}`
      )
    }
  }

  if (sections.length) return sections.join('\n\n')

  return str(entry.body) ??
    str(entry.text) ??
    str(entry.content) ??
    str(entry.brief) ??
    str(entry.markdown)
}

export function normalizeScreen(
  screenNumber: number,
  raw: Record<string, unknown>
): ScreenData | null {
  const source = record(raw.screen) ?? raw

  const briefsRaw = source.briefs
  if (!Array.isArray(briefsRaw) || briefsRaw.length === 0) {
    return null
  }

  const reviewsRaw = source.reviews
  if (!Array.isArray(reviewsRaw) || reviewsRaw.length === 0) {
    return null
  }

  const reviews: SourceReview[] = []

  for (const value of reviewsRaw) {
    const item = record(value)
    if (!item) return null

    const position = int(item.position)
    const text = str(item.text)

    if (position === null || text === null) return null

    reviews.push({
      position,
      rating: int(item.rating),
      text,
    })
  }

  // Preserve the order returned by the frozen backend.
  const briefs: Brief[] = []
  const existingAnswers: AnswerDraft[] = []

  for (const value of briefsRaw) {
    const entry = record(value)
    if (!entry) return null

    const label = str(entry.label)
    const body = readBriefBody(entry)

    if (!label || !body) return null

    briefs.push({
      label,
      title: str(entry.title),
      body,
    })

    const scores =
      record(entry.scores) ??
      record(entry.ratings) ??
      record(entry.answer) ??
      entry

    existingAnswers.push({
      label,
      groundedness: int(scores.groundedness),
      coverage: int(scores.coverage),
      actionability: int(scores.actionability),
      comment: str(scores.comment),
    })
  }

  const status = str(source.status)

  const pilotFlag = source.is_pilot ?? source.isPilot
  const isPilot = typeof pilotFlag === 'boolean'
    ? pilotFlag
    : screenNumber <= 3

  const finalized =
    status === 'finalized' ||
    status === 'submitted' ||
    source.editable === false ||
    source.finalized === true

  const draftRevision =
    int(source.draft_revision ?? source.draftRevision) ?? 0

  const preference =
    str(source.selected_preference) ??
    str(source.preference_label) ??
    str(source.preference)

  return {
    screenNumber,
    isPilot,
    status,
    finalized,
    draftRevision,
    reviews,
    briefs,
    existingAnswers,
    existingPreference: preference,
  }
}
