interface NoticeProps {
  kind: 'error' | 'success' | 'info'
  children: React.ReactNode
}

const styles: Record<NoticeProps['kind'], string> = {
  error: 'border-red-300 bg-red-50 text-red-800',
  success: 'border-teal-600 bg-teal-100 text-teal-700',
  info: 'border-slate-300 bg-slate-100 text-slate-700',
}

export function Notice({ kind, children }: NoticeProps) {
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-md border px-4 py-3 text-sm ${styles[kind]}`}>
      {children}
    </div>
  )
}
