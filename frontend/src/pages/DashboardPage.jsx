import { Navigate } from 'react-router-dom'
import { getDashboardPath, getUser } from '../utils/auth.js'

function DashboardPage() {
  const user = getUser()
  return <Navigate replace to={getDashboardPath(user?.role)} />
}

export default DashboardPage
