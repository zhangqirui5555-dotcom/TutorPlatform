import { Navigate, useLocation } from 'react-router-dom'
import {
  clearAuth,
  getDashboardPath,
  getToken,
  getUser,
} from '../utils/auth.js'

function RoleRoute({ allowedRole, children }) {
  const location = useLocation()
  const token = getToken()
  const user = getUser()

  if (!token || !user) {
    clearAuth()
    return <Navigate replace state={{ from: location.pathname }} to="/login" />
  }

  if (user.role !== allowedRole) {
    return <Navigate replace to={getDashboardPath(user.role)} />
  }

  return children
}

export default RoleRoute
