import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { checkAccess } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Notice } from '../components/ui/Notice'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError || !data.session) {
        setError(signInError?.message ?? 'Sign-in failed. Please check your email and password.')
        return
      }
      const role = await checkAccess()
      if (!role) {
        await supabase.auth.signOut()
        setError('This account is not authorized for the evaluation portal.')
        return
      }
      navigate(role === 'rater' ? '/evaluate' : '/researcher', { replace: true })
    } catch {
      setError('Sign-in could not be completed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Research Study</p>
        <h1 className="mt-2 text-3xl font-bold">Managerial Insight Evaluation Portal</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Sign in with the account you were given for this study.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {error && <Notice kind="error">{error}</Notice>}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink-800">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink-800">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
          />
        </div>
        <Button type="submit" loading={busy} className="w-full">
          Sign in
        </Button>
      </form>
    </div>
  )
}
