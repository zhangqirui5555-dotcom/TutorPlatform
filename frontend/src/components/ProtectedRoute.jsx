import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import client from '../api/client.js'
import { clearAuth, getToken } from '../utils/auth.js'

function ProtectedRoute({ children }) {
  const location = useLocation()
  const token = getToken()
  const [isChecking, setIsChecking] = useState(Boolean(token))
  const [isValid, setIsValid] = useState(Boolean(token))

  useEffect(() => {
    let isMounted = true

    if (!token) {
      setIsChecking(false)
      setIsValid(false)
      return () => {
        isMounted = false
      }
    }

    setIsChecking(true)
    client.get('/users/me')
      .then(() => {
        if (isMounted) {
          setIsValid(true)
        }
      })
      .catch(() => {
        clearAuth()
        if (isMounted) {
          setIsValid(false)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsChecking(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [token])

  if (!token || (!isChecking && !isValid)) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />
  }

  if (isChecking) {
    return <div className="loading-state">姝ｅ湪楠岃瘉璐﹀彿鐘舵€佲€?/div>
  }

  return children
}

export default ProtectedRoute

