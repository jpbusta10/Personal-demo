import { useRef, useEffect } from 'react'
import { usePlayerLog } from './PlayerLogContext.jsx'

const LEVEL_STYLES = {
  info: 'text-slate-300 dark:text-slate-400',
  warn: 'text-amber-400 dark:text-amber-300',
  error: 'text-red-400 dark:text-red-300',
}

export default function PlayerLogConsole() {
  const { logs, clearLogs } = usePlayerLog()
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  return (
    <div className="rounded-b-xl overflow-hidden border border-t-0 border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-950">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800/50 dark:bg-slate-900/50">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Player log</span>
        <button
          type="button"
          onClick={clearLogs}
          className="text-xs px-2 py-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="h-40 overflow-y-auto font-mono text-xs p-2 space-y-0.5">
        {logs.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-600">No logs yet. Load a stream to see activity.</p>
        ) : (
          logs.map(({ id, time, level, message, detail }) => (
            <div key={id} className="flex gap-2 flex-wrap items-baseline">
              <span className="text-slate-500 dark:text-slate-600 shrink-0">{time}</span>
              <span className="shrink-0 font-semibold uppercase text-slate-500">{level}</span>
              <span className={LEVEL_STYLES[level] || LEVEL_STYLES.info}>{message}</span>
              {detail && <span className="text-slate-500 truncate max-w-full" title={detail}>{detail}</span>}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
