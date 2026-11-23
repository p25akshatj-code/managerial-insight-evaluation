import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ApiError } from '../types'
import { approvePilot, checkAccess } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Notice } from '../components/ui/Notice'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useAuth } from '../lib/auth'

export default function ResearcherPage() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState<'checking' | 'ok' | 'invalid'>('checking')
  const [raterId, setRaterId] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    checkAccess()
      .then((r) => {
        if (cancelled) return
        if (r === 'researcher') setRole('ok')
        else setRole('invalid')
      })
      .catch(() => {
        if (!cancelled) setRole('invalid')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleApprove() {
    setBusy(true)
    setResult(null)
    try {
      await approvePilot(raterId.trim().toUpperCase())
      setResult({ kind: 'success', message: `Pilot approved for rater ${raterId.trim().toUpperCase()}.` })
      setRaterId('')
    } catch (error) {
      const apiError = error as ApiError
      if (apiError.status === 503) {
        setResult({ kind: 'error', message: 'Evaluation submissions are not yet open. Your ratings cannot be submitted at this time.' })
      } else {
        setResult({ kind: 'error', message: apiError.message })
      }
    } finally {
      setBusy(false)
      setConfirmOpen(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Researcher</p>
          <h1 className="text-2xl font-bold">Pilot Approval</h1>
        </div>
        <Button variant="ghost" onClick={handleSignOut}>
          Sign out
        </Button>
      </header>

      {role === 'checking' && <p className="text-sm text-slate-500">Verifying your access…</p>}

      {role === 'invalid' && (
        <Notice kind="error">This account does not have researcher access to the evaluation portal.</Notice>
      )}

      {role === 'ok' && (
        <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <Notice kind="info">
            Signed in as researcher{session?.user?.email ? ` (${session.user.email})` : ''}.
          </Notice>
          <p className="text-[15px] leading-relaxed text-slate-800">
            Enter a participant's rater ID to approve their pilot submission. Approval unlocks the main evaluation for
            that participant.
          </p>
          <div>
            <label htmlFor="rater-id" className="block text-sm font-medium text-ink-800">
              Rater ID
            </label>
            <input
              id="rater-id"
              type="text"
              placeholder="R01"
              value={raterId}
              onChange={(e) => setRaterId(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm uppercase focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </div>
          {result?.kind === 'success' && <Notice kind="success">{result.message}</Notice>}
          {result?.kind === 'error' && <Notice kind="error">{result.message}</Notice>}
          <Button disabled={raterId.trim().length === 0} onClick={() => setConfirmOpen(true)}>
            Approve pilot
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Approve pilot"
        description={`Approve the pilot submission for rater ${raterId.trim().toUpperCase()}? This unlocks their main evaluation and cannot be undone from this page.`}
        confirmLabel="Approve"
        busy={busy}
        onConfirm={() => void handleApprove()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
