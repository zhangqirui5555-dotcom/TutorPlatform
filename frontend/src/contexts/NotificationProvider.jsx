import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getUnreadCount } from '../api/notification.js'
import { getToken, getUser } from '../utils/auth.js'
import NotificationContext from './notificationContext.js'

const REFRESH_INTERVAL = 30000

function NotificationProvider({ children }) {
  useLocation()
  const [unreadCount, setUnreadCount] = useState(0)
  const requestId = useRef(0)
  const token = getToken()
  const user = getUser()
  const sessionKey = token && user ? `${user.id}:${token}` : ''

  const refreshUnreadCount = useCallback(async () => {
    const activeToken = getToken()
    if (!activeToken) {
      setUnreadCount(0)
      return 0
    }

    const currentRequest = ++requestId.current
    try {
      const count = await getUnreadCount()
      if (currentRequest === requestId.current && getToken() === activeToken) {
        setUnreadCount(Number.isSafeInteger(count) && count > 0 ? count : 0)
      }
      return count
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (!sessionKey) {
      requestId.current += 1
      setUnreadCount(0)
      return undefined
    }

    refreshUnreadCount()
    const intervalId = window.setInterval(refreshUnreadCount, REFRESH_INTERVAL)
    const handleFocus = () => refreshUnreadCount()
    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [refreshUnreadCount, sessionKey])

  const value = useMemo(() => ({
    unreadCount,
    refreshUnreadCount,
    decrementUnreadCount: () => setUnreadCount((current) => Math.max(0, current - 1)),
    clearUnreadCount: () => setUnreadCount(0),
  }), [refreshUnreadCount, unreadCount])

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export default NotificationProvider
