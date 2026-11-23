import { useCallback, useEffect, useState } from 'react'
import type { ApiError } from '../types'
import type { ProgressResult } from '../lib/api'
import { getProgress, submitStage } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Notice } from '../components/ui/Notice'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { WorkingScreen } from './evaluate/WorkingScreen'
import { useAuth } from '../lib/auth'
import { useNavigate } from 'react-router-dom'

type View =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'instructions' }
  | { kind: 'working'; screenNumber: number }
  | { kind: 'submitPilot' }
  | { kind: 'awaitingApproval' }
  | { kind: 'submitMain' }
  | { kind: 'complete' }

const PILOT_SCREENS = [1, 2, 3]


function getCompletedScreenNumbers(
  progress: ProgressResult
): number[] {
  return (progress.screens ?? [])
    .filter(
      (screen) =>
        screen.status === 'completed' ||
        screen.status === 'finalized'
    )
    .map((screen) => screen.screen_number)
}


export default function EvaluatePage() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [progress, setProgress] = useState<ProgressResult | null>(null)
  const [consentAcknowledged, setConsentAcknowledged] = useState(false)
  const [stageBusy, setStageBusy] = useState(false)
  const [stageError, setStageError] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<'pilot' | 'main' | null>(null)

  const refresh = useCallback(async (): Promise<ProgressResult> => {
    const next = await getProgress()
    setProgress(next)
    return next
  }, [])

  useEffect(() => {
    let cancelled = false
    refresh()
      .then((p) => {
        if (cancelled) return
        setView(decideView(p))
      })
      .catch((error: ApiError) => {
        if (cancelled) return
        if (error.status === 401) return
        setView({ kind: 'error', message: error.message })
      })
    return () => {
      cancelled = true
    }
  }, [refresh])

  
function decideView(p: ProgressResult): View {
  const completed = getCompletedScreenNumbers(p)

  const pilotDone = PILOT_SCREENS.every(
    (n) => completed.includes(n)
  )

  if (!pilotDone) {
    const nextPilot = PILOT_SCREENS.find(
      (n) => !completed.includes(n)
    )

    if (nextPilot == null) {
      return { kind: 'submitPilot' }
    }

    return consentAcknowledged
      ? {
          kind: 'working',
          screenNumber: nextPilot,
        }
      : { kind: 'instructions' }
  }

  if (p.pilot_approved === false) {
    return { kind: 'awaitingApproval' }
  }

  const total = p.total_screens

  const mainScreens = total
    ? Array.from(
        { length: total },
        (_, i) => i + 1
      ).filter(
        (n) => !PILOT_SCREENS.includes(n)
      )
    : []

  const remainingMain = mainScreens.filter(
    (n) => !completed.includes(n)
  )

  if (remainingMain.length === 0) {
    return { kind: 'submitMain' }
  }

  if (p.next_screen != null) {
    return {
      kind: 'working',
      screenNumber: p.next_screen,
    }
  }

  return {
    kind: 'error',
    message:
      'Progress could not determine the next screen. Please reload the page.',
  }
}


  async function handleStageSubmit(stage: 'pilot' | 'main') {
    setStageBusy(true)
    setStageError(null)
    try {
      await submitStage(stage)
      if (stage === 'pilot') {
        const p = await refresh()
        setView(p.pilot_approved ? decideView(p) : { kind: 'awaitingApproval' })
      } else {
        setView({ kind: 'complete' })
      }
    } catch (error) {
      const apiError = error as ApiError
      setStageError(apiError.message)
    } finally {
      setStageBusy(false)
      setConfirmDialog(null)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  
const completedScreenNumbers = progress
  ? getCompletedScreenNumbers(progress)
  : []

const completedCount = completedScreenNumbers.length

const totalScreens = progress?.total_screens ?? null

const pilotDone = PILOT_SCREENS.every(
  (n) => completedScreenNumbers.includes(n)
)


  function renderBody() {
    switch (view.kind) {
      case 'loading':
        return <p className="py-16 text-center text-sm text-slate-500">Loading your progress…</p>

      case 'error':
        return (
          <div className="space-y-4">
            <Notice kind="error">{view.message}</Notice>
            <Button
              variant="secondary"
              onClick={() => {
                setView({ kind: 'loading' })
                refresh()
                  .then((p) => setView(decideView(p)))
                  .catch((e: ApiError) => setView({ kind: 'error', message: e.message }))
              }}
            >
              Try again
            </Button>
          </div>
        )

      case 'instructions':
        return (
          <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-bold">Study instructions</h2>
            <div className="space-y-3 text-[15px] leading-relaxed text-slate-800">
              <p>
                In this study you will evaluate anonymized managerial insight briefs. Each brief was produced by an
                AI system; no information about which system produced which brief is shown.
              </p>
              <p>
                For every brief, rate <strong>groundedness</strong>, <strong>coverage</strong>, and{' '}
                <strong>actionability</strong> on a scale from 1 to 7, and add an optional comment. On screens with
                five briefs you will also be asked to select the single best brief.
              </p>
              <p>
                Your ratings are saved automatically as you work, but you must press <strong>Save and continue</strong>{' '}
                at the end of each screen to record them and move on. Once a screen is saved and finalized it can no
                longer be edited.
              </p>
              <p>
                The study has two parts. Screens 1–3 are a pilot round; after submitting the pilot you will wait for a
                researcher to approve it before the main evaluation unlocks. In total you will complete 29 screens.
              </p>
              <p className="text-sm text-slate-600">
                Participation is voluntary and your responses are treated confidentially for research purposes. This
                acknowledgement is recorded in your browser only; it is not submitted to the research server.
              </p>
            </div>
            <label className="flex items-start gap-3 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={consentAcknowledged}
                onChange={(e) => setConsentAcknowledged(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-100"
              />
              <span>I have read and understood the study information above, and I agree to participate.</span>
            </label>
            <Button disabled={!consentAcknowledged} onClick={() => progress && setView(decideView(progress))}>
              Begin the pilot round
            </Button>
          </div>
        )

      case 'working':
        return (
          <WorkingScreen
            key={view.screenNumber}
            initialScreenNumber={view.screenNumber}
            refreshProgress={async () => {
              const p = await refresh()
              const decided = decideView(p)
              if (decided.kind !== 'working' || decided.screenNumber !== view.screenNumber) {
                setView(decided)
              }
              return p
            }}
          />
        )

      case 'submitPilot':
        return (
          <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-bold">Pilot round complete</h2>
            <p className="text-[15px] leading-relaxed text-slate-800">
              You have completed all three pilot screens. Submitting the pilot finalizes those screens and sends them
              for researcher review. You will not be able to edit them afterwards.
            </p>
            {stageError && <Notice kind="error">{stageError}</Notice>}
            <Button onClick={() => setConfirmDialog('pilot')} loading={stageBusy}>
              Submit pilot for review
            </Button>
          </div>
        )

      case 'awaitingApproval':
        return (
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
            <h2 className="text-xl font-bold">Waiting for approval</h2>
            <p className="mx-auto max-w-md text-[15px] leading-relaxed text-slate-800">
              Your pilot submission has been received. A researcher will review it, and the main evaluation will unlock
              once it is approved. This page will show the next screen as soon as approval is granted — you can refresh
              to check.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                setView({ kind: 'loading' })
                refresh()
                  .then((p) => setView(decideView(p)))
                  .catch((e: ApiError) => setView({ kind: 'error', message: e.message }))
              }}
            >
              Check again
            </Button>
          </div>
        )

      case 'submitMain':
        return (
          <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-bold">Evaluation complete</h2>
            <p className="text-[15px] leading-relaxed text-slate-800">
              You have completed every screen. Submitting finalizes your entire evaluation — it can no longer be edited
              afterwards.
            </p>
            {stageError && <Notice kind="error">{stageError}</Notice>}
            <Button onClick={() => setConfirmDialog('main')} loading={stageBusy}>
              Submit final evaluation
            </Button>
          </div>
        )

      case 'complete':
        return (
          <div className="space-y-4 rounded-lg border border-teal-600 bg-teal-100 p-8 text-center">
            <h2 className="text-2xl font-bold text-ink-900">Thank you</h2>
            <p className="mx-auto max-w-md text-[15px] leading-relaxed text-slate-800">
              Your evaluation has been submitted in full. Your contribution to this research is greatly appreciated.
            </p>
          </div>
        )
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Participant</p>
          <h1 className="text-2xl font-bold">Managerial Insight Evaluation</h1>
        </div>
        <Button variant="ghost" onClick={handleSignOut}>
          Sign out
        </Button>
      </header>

      {totalScreens != null && view.kind !== 'complete' && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>
              Progress: {completedCount} of {totalScreens} screens
              {!pilotDone && ' (pilot round)'}
            </span>
            {progress?.pilot_approved === false && pilotDone && <span>Pilot under review</span>}
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-teal-600 transition-all"
              style={{ width: `${totalScreens > 0 ? Math.round((completedCount / totalScreens) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {renderBody()}

      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog === 'pilot' ? 'Submit pilot?' : 'Submit final evaluation?'}
        description={
          confirmDialog === 'pilot'
            ? 'Your three pilot screens will be finalized and sent for researcher review. They can no longer be edited.'
            : 'Your complete evaluation will be finalized. It can no longer be edited.'
        }
        confirmLabel="Submit"
        busy={stageBusy}
        onConfirm={() => confirmDialog && void handleStageSubmit(confirmDialog)}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  )
}
