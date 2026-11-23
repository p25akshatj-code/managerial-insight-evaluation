import { BrowserRouter, Navigate, Route, Routes, HashRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import LoginPage from './pages/LoginPage'
import EvaluatePage from './pages/EvaluatePage'
import ResearcherPage from './pages/ResearcherPage'
import { checkAccess } from './lib/api'
import { useEffect, useState } from 'react'
import type { Role } from './types'

function FullScreenSpinner() {
  return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RoleGate({ role: required, children }: { role: Role; children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'ok' | 'deny'>('checking')
  useEffect(() => {
    let cancelled = false
    checkAccess()
      .then((r) => {
        if (cancelled) return
        setState(r === required ? 'ok' : 'deny')
      })
      .catch(() => {
        if (!cancelled) setState('deny')
      })
    return () => {
      cancelled = true
    }
  }, [required])

  if (state === 'checking') return <FullScreenSpinner />
  if (state === 'deny') return <Navigate to="/login" replace />
  return <>{children}</>
}

function LoginRoute() {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (session) {
    return (
      <PostLoginRedirect />
    )
  }
  return <LoginPage />
}

function PostLoginRedirect() {
  const [target, setTarget] = useState<string | null>(null)
  useEffect(() => {
    checkAccess()
      .then((r) => setTarget(r === 'rater' ? '/evaluate' : r === 'researcher' ? '/researcher' : '/login'))
      .catch(() => setTarget('/login'))
  }, [])
  return target ? <Navigate to={target} replace /> : <FullScreenSpinner />
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<LoginRoute />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route
            path="/evaluate"
            element={
              <RequireAuth>
                <RoleGate role="rater">
                  <EvaluatePage />
                </RoleGate>
              </RequireAuth>
            }
          />
          <Route
            path="/researcher"
            element={
              <RequireAuth>
                <RoleGate role="researcher">
                  <ResearcherPage />
                </RoleGate>
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
