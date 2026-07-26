import { Navigate, useLocation } from 'react-router-dom'
import { getToken } from '../utils/auth.js'

function ProtectedRoute({ children }) {
  const location = useLocation()

  if (!getToken()) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />
  }

  return children
}

export default ProtectedRoute
