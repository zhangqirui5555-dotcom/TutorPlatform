const TOKEN_KEY = 'token'
const USER_KEY = 'user'
const ROLE_DASHBOARD_PATHS = {
  ADMIN: '/admin/dashboard',
  PARENT: '/parent/dashboard',
  STUDENT: '/student/dashboard',
}

export function saveAuth(token, user) {
  window.localStorage.setItem(TOKEN_KEY, token)
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getToken() {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function getUser() {
  const storedUser = window.localStorage.getItem(USER_KEY)

  if (!storedUser) {
    return null
  }

  try {
    return JSON.parse(storedUser)
  } catch {
    clearAuth()
    return null
  }
}

export function clearAuth() {
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

export function getDashboardPath(role) {
  return ROLE_DASHBOARD_PATHS[role] || '/login'
}
