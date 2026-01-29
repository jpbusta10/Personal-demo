import { useRef } from 'react'

export default function VideoPlayerBase({
  children,
  title,
  description,
  className = '',
  error = null,
  loading = false,
  stats = null,
}) {
  const containerRef = useRef(null)

  return (
    <div
      ref={containerRef}
      className={`rounded-xl overflow-hidden bg-slate-900 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 ${className}`}
    >
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        {description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{description}</p>
        )}
      </div>
      <div className="relative aspect-video bg-black">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-10 p-4">
            <p className="text-red-400 text-center text-sm">{error}</p>
          </div>
        )}
        {children}
      </div>
      {stats && (
        <div className="p-3 bg-slate-800/50 dark:bg-slate-900/50 text-xs font-mono text-slate-300 overflow-x-auto">
          {stats}
        </div>
      )}
    </div>
  )
}
