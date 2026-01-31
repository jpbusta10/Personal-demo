import { createContext, useContext, useState, useCallback } from 'react'

const PlayerLogContext = createContext(null)

export function usePlayerLog() {
  const ctx = useContext(PlayerLogContext)
  return ctx
}

export function PlayerLogProvider({ children }) {
  const [logs, setLogs] = useState([])

  const addLog = useCallback((level, message, detail = null) => {
    const entry = {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      level: level || 'info',
      message: typeof message === 'string' ? message : String(message),
      detail: detail != null ? (typeof detail === 'object' ? JSON.stringify(detail, null, 0) : String(detail)) : null,
    }
    setLogs((prev) => [...prev.slice(-499), entry])
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  return (
    <PlayerLogContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </PlayerLogContext.Provider>
  )
}
