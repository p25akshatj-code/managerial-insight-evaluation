import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnswerDraft, ApiError, ScreenData } from '../../types'
import type { ProgressResult } from '../../lib/api'
import { autosave, getScreen, saveScreen } from '../../lib/api'
import { BriefCard } from './BriefCard'
import { normalizeScreen } from './normalize'
import { Button } from '../../components/ui/Button'
import { Notice } from '../../components/ui/Notice'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { SourceReviews } from './SourceReviews'

interface WorkingScreenProps {
  initialScreenNumber: number
  refreshProgress: () => Promise<ProgressResult>
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const AUTOSAVE_DELAY_MS = 1500

function rawPreview(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2).slice(0, 2000)
  } catch {
    return 'Structure could not be displayed.'
  }
}

export function WorkingScreen({ initialScreenNumber, refreshProgress }: WorkingScreenProps) {
  const [screenNumber, setScreenNumber] = useState(initialScreenNumber)
  const [loadState, setLoadState] = useState<{ kind: 'loading' | 'error' | 'diagnostic' | 'ready'; message?: string; raw?: unknown; screen?: ScreenData }>({
    kind: 'loading',
  })
  const [answers, setAnswers] = useState<AnswerDraft[]>([])
  const [preference, setPreference] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [conflictDialog, setConflictDialog] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const autosaveTimer = useRef<number | null>(null)
  const autosavePending = useRef<Promise<void> | null>(null)
  const saveInProgressRef = useRef(false)
  const answersRef = useRef(answers)
  const preferenceRef = useRef(preference)
  const revisionRef = useRef(revision)
  const conflictRef = useRef(conflict)
  answersRef.current = answers
  preferenceRef.current = preference
  revisionRef.current = revision
  conflictRef.current = conflict

  const screen = loadState.kind === 'ready' ? loadState.screen : null
  const finalized = screen?.finalized ?? false
  const isFiveBrief = (screen?.briefs.length ?? 0) > 1

  useEffect(() => {
    let cancelled = false
    setLoadState({ kind: 'loading' })
    setConflict(false)
    setSaveState('idle')
    setSaveMessage(null)
    setValidationError(null)
    getScreen(screenNumber)
      .then((raw) => {
        if (cancelled) return
        const normalized = normalizeScreen(screenNumber, raw)
        if (!normalized) {
          setLoadState({ kind: 'diagnostic', message: 'The screen content returned by the research server could not be interpreted. No briefs are shown rather than displaying invented content.', raw })
          return
        }
        setLoadState({ kind: 'ready', screen: normalized })
        setAnswers(normalized.existingAnswers)
        setPreference(normalized.existingPreference)
        revisionRef.current = normalized.draftRevision
        setRevision(normalized.draftRevision)
      })
      .catch((error: ApiError) => {
        if (cancelled) return
        if (error.status === 401) return
        setLoadState({ kind: 'error', message: error.message })
      })
    return () => {
      cancelled = true
    }
  }, [screenNumber])

  const runAutosave = useCallback((): Promise<void> => {
    if (autosavePending.current) return autosavePending.current
    if (saveInProgressRef.current || conflictRef.current || finalized) return Promise.resolve()

    const task = (async () => {
      setSaveState('saving')
      try {
        const payloadAnswers = answersRef.current.map((a) => ({
          label: a.label,
          ...(a.groundedness != null ? { groundedness: a.groundedness } : {}),
          ...(a.coverage != null ? { coverage: a.coverage } : {}),
          ...(a.actionability != null ? { actionability: a.actionability } : {}),
          ...(a.comment?.trim() ? { comment: a.comment } : {}),
        }))
        const result = await autosave({
          screenNumber,
          expectedDraftRevision: revisionRef.current,
          answers: payloadAnswers,
          preferenceLabel: isFiveBrief ? preferenceRef.current : null,
        })
        revisionRef.current = result.draft_revision
        setRevision(result.draft_revision)
        setSaveState('saved')
        setSaveMessage(null)
      } catch (error) {
        const apiError = error as ApiError
        if (apiError.status === 409) {
          conflictRef.current = true
          setConflict(true)
          setSaveMessage('Your changes are out of date with the server. Automatic saving has stopped.')
        } else if (apiError.status === 503) {
          setSaveMessage('Evaluation submissions are not yet open. Your ratings cannot be submitted at this time.')
        } else {
          setSaveMessage('Automatic saving failed. Your unsaved changes remain on this page.')
        }
        setSaveState('error')
      }
    })()

    autosavePending.current = task
    void task.finally(() => {
      if (autosavePending.current === task) autosavePending.current = null
    })
    return task
  }, [screenNumber, isFiveBrief, finalized])

  function onAnswerChange(next: AnswerDraft) {
    if (finalized || conflictRef.current || saveInProgressRef.current) return
    setAnswers((prev) => prev.map((a) => (a.label === next.label ? next : a)))
    setSaveState('idle')
    if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = window.setTimeout(() => void runAutosave(), AUTOSAVE_DELAY_MS)
  }

  function onPreferenceChange(label: string) {
    if (finalized || conflictRef.current || saveInProgressRef.current) return
    setPreference(label)
    setSaveState('idle')
    if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = window.setTimeout(() => void runAutosave(), AUTOSAVE_DELAY_MS)
  }

  async function handleSave() {
    if (!screen || saveInProgressRef.current || conflictRef.current || finalized) return
    setValidationError(null)
    const incomplete = answers.filter((a) =>
      a.groundedness == null || a.coverage == null || a.actionability == null
    )
    if (incomplete.length) {
      setValidationError(`Please provide all three ratings for every brief. Missing: ${incomplete.map((a) => a.label).join(', ')}.`)
      return
    }
    if (isFiveBrief && !preference) {
      setValidationError('Please select the best brief before saving.')
      return
    }

    saveInProgressRef.current = true
    setSaveBusy(true)
    setSaveState('saving')
    if (autosaveTimer.current !== null) {
      window.clearTimeout(autosaveTimer.current)
      autosaveTimer.current = null
    }

    try {
      // Drain an in-flight autosave before using its new revision.
      if (autosavePending.current) await autosavePending.current
      if (conflictRef.current) throw Object.assign(new Error('revision_conflict'), { status: 409 })

      const result = await saveScreen({
        screenNumber,
        expectedDraftRevision: revisionRef.current,
        answers: answers.map((a) => ({
          label: a.label,
          groundedness: a.groundedness!,
          coverage: a.coverage!,
          actionability: a.actionability!,
          ...(a.comment?.trim() ? { comment: a.comment } : {}),
        })),
        preferenceLabel: isFiveBrief ? preference : null,
      })
      revisionRef.current = result.draft_revision
      setRevision(result.draft_revision)
      setSaveState('saved')
      setSaveMessage(null)
      // Parent decides whether to show next screen, pilot submission or main submission.
      await refreshProgress()
    } catch (error) {
      const apiError = error as ApiError
      if (apiError.status === 409) {
        conflictRef.current = true
        setConflict(true)
        setSaveMessage('The server has newer ratings. Refresh from server to resolve the conflict.')
        setConflictDialog(true)
      } else {
        setSaveMessage(apiError.message || 'Save failed. Your entries remain on this page.')
      }
      setSaveState('error')
    } finally {
      saveInProgressRef.current = false
      setSaveBusy(false)
    }
  }

  function reloadFromServer() {
    setConflictDialog(false)
    setScreenNumber((n) => n)
    setLoadState({ kind: 'loading' })
    getScreen(screenNumber)
      .then((raw) => {
        const normalized = normalizeScreen(screenNumber, raw)
        if (!normalized) {
          setLoadState({ kind: 'diagnostic', message: 'The screen content returned by the research server could not be interpreted.', raw })
          return
        }
        setLoadState({ kind: 'ready', screen: normalized })
        setAnswers(normalized.existingAnswers)
        setPreference(normalized.existingPreference)
        setRevision(normalized.draftRevision)
        conflictRef.current = false
        setConflict(false)
        setSaveState('idle')
        setSaveMessage(null)
      })
      .catch((error: ApiError) => {
        setLoadState({ kind: 'error', message: error.message })
      })
  }

  useEffect(() => {
    return () => {
      if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current)
    }
  }, [])

  if (loadState.kind === 'loading') {
    return <p className="py-16 text-center text-sm text-slate-500">Loading screen {screenNumber}…</p>
  }

  if (loadState.kind === 'diagnostic') {
    return (
      <div className="space-y-4">
        <Notice kind="error">{loadState.message}</Notice>
        <details className="rounded-md border border-slate-300 bg-white p-4 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium">Technical details for the research team</summary>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap">{rawPreview(loadState.raw)}</pre>
        </details>
      </div>
    )
  }

  if (loadState.kind === 'error') {
    return (
      <div className="space-y-4">
        <Notice kind="error">{loadState.message}</Notice>
        <Button variant="secondary" onClick={() => setScreenNumber((n) => n)}>
          Try again
        </Button>
      </div>
    )
  }

  const current = loadState.screen!

  return (
    <div className="space-y-6">
      <SourceReviews reviews={current.reviews} />
      {conflict && (
        <Notice kind="error">
          Your ratings on this screen are out of date with the server. Automatic saving has stopped to avoid overwriting
          newer ratings. You can refresh this screen from the server, which discards unsaved changes from this page.
          <div className="mt-3">
            <Button variant="secondary" onClick={() => setConflictDialog(true)}>
              Resolve conflict
            </Button>
          </div>
        </Notice>
      )}

      {finalized && (
        <Notice kind="info">
          This screen has been finalized and submitted. Ratings can no longer be edited.
        </Notice>
      )}

      {current.briefs.map((brief) => (
        <BriefCard
          key={brief.label}
          brief={brief}
          answer={answers.find((a) => a.label === brief.label) ?? { label: brief.label, groundedness: null, coverage: null, actionability: null, comment: null }}
          disabled={finalized || conflict || saveBusy}
          onChange={onAnswerChange}
        />
      ))}

      {isFiveBrief && (
        <section className="rounded-lg border border-teal-600 bg-teal-100 p-5">
          <h3 className="text-base font-semibold text-ink-900">Best of five</h3>
          <p className="mt-1 text-sm text-slate-700">Which of the five briefs above provides the most managerial insight overall?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {current.briefs.map((b) => (
              <label
                key={b.label}
                className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border text-sm font-bold transition-colors ${
                  preference === b.label
                    ? 'border-teal-700 bg-teal-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-teal-600'
                } ${finalized || conflict ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="preference"
                  value={b.label}
                  checked={preference === b.label}
                  disabled={finalized || conflict}
                  onChange={() => onPreferenceChange(b.label)}
                  className="sr-only"
                />
                {b.label}
              </label>
            ))}
          </div>
        </section>
      )}

      {validationError && <Notice kind="error">{validationError}</Notice>}
      {saveMessage && saveState === 'error' && <Notice kind="error">{saveMessage}</Notice>}

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="text-sm text-slate-600">
          {conflict
            ? 'Waiting for conflict resolution.'
            : saveState === 'saving'
              ? 'Saving…'
              : saveState === 'saved'
                ? 'All changes saved.'
                : finalized
                  ? 'Finalized.'
                  : 'Ratings save automatically as you work.'}
        </p>
        <Button onClick={handleSave} loading={saveBusy} disabled={finalized || conflict || saveBusy}>
          Save and continue
        </Button>
      </div>

      <ConfirmDialog
        open={conflictDialog}
        title="Resolve revision conflict"
        description="The server has newer ratings for this screen than the page you are viewing. To resolve, refresh the screen from the server. Any unsaved changes on this page will be discarded."
        confirmLabel="Refresh from server"
        busy={false}
        onConfirm={reloadFromServer}
        onCancel={() => setConflictDialog(false)}
      />
    </div>
  )
}
