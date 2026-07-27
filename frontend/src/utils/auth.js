const TOKEN_KEY = 'token'
const USER_KEY = 'user'
const ROLE_DASHBOARD_PATHS = {
  ADMIN: '/admin/dashboard',
  PARENT: '/parent/dashboard',
  STUDENT: '/student/dashboard',
}

export function saveAuth(token, user) {
  window.sessionStorage.setItem(TOKEN_KEY, token)
  window.sessionStorage.setItem(USER_KEY, JSON.stringify(user))
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

export function getToken() {
  return window.sessionStorage.getItem(TOKEN_KEY)
}

export function getUser() {
  const storedUser = window.sessionStorage.getItem(USER_KEY)

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
  window.sessionStorage.removeItem(TOKEN_KEY)
  window.sessionStorage.removeItem(USER_KEY)
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

export function getDashboardPath(role) {
  return ROLE_DASHBOARD_PATHS[role] || '/login'
}
