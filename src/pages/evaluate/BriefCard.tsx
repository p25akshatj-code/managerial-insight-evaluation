import type { AnswerDraft, Brief } from '../../types'
import { RatingControl } from './RatingControl'

interface BriefCardProps {
  brief: Brief
  answer: AnswerDraft
  disabled?: boolean
  onChange: (next: AnswerDraft) => void
}

export function BriefCard({ brief, answer, disabled, onChange }: BriefCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <header className="flex items-baseline gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
          {brief.label}
        </span>
        {brief.title && <h3 className="text-base font-semibold leading-snug">{brief.title}</h3>}
      </header>

      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-slate-800">
        {(brief.body ?? '').split(/\n{2,}/).map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      <div className="mt-2 border-t border-slate-100">
        <RatingControl
          label="Groundedness"
          description="How well grounded in evidence does it feel? (1–7)"
          name={`${brief.label}-groundedness`}
          value={answer.groundedness}
          disabled={disabled}
          onChange={(groundedness) => onChange({ ...answer, groundedness })}
        />
        <RatingControl
          label="Coverage"
          description="How thoroughly does it cover the topic? (1–7)"
          name={`${brief.label}-coverage`}
          value={answer.coverage}
          disabled={disabled}
          onChange={(coverage) => onChange({ ...answer, coverage })}
        />
        <RatingControl
          label="Actionability"
          description="How usable are its recommendations? (1–7)"
          name={`${brief.label}-actionability`}
          value={answer.actionability}
          disabled={disabled}
          onChange={(actionability) => onChange({ ...answer, actionability })}
        />

        <div className="mt-4">
          <label htmlFor={`${brief.label}-comment`} className="block text-sm font-semibold text-ink-800">
            Comment <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id={`${brief.label}-comment`}
            rows={2}
            value={answer.comment ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...answer, comment: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
          />
        </div>
      </div>
    </article>
  )
}
