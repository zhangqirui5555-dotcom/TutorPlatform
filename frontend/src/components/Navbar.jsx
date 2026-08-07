import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import useNotification from '../contexts/useNotification.js'
import { getDashboardPath, getToken, getUser } from '../utils/auth.js'

function NotificationLink({ className = '' }) {
  const { unreadCount } = useNotification()

  return (
    <NavLink
      aria-label={unreadCount > 0 ? `通知中心，${unreadCount}条未读` : '通知中心'}
      className={`nav-notification-link ${className}`}
      to="/notifications"
    >
      <span className="nav-notification-icon" aria-hidden="true">🔔</span>
      <span>通知</span>
      {unreadCount > 0 && (
        <span className="nav-notification-badge">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </NavLink>
  )
}

function Navbar() {
  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const user = getUser()
  const isAuthenticated = Boolean(getToken() && user)

  useEffect(() => {
    setIsMenuOpen(false)
  }, [location.pathname])

  return (
    <header className="site-navbar">
      <NavLink className="brand" to="/">
        <span className="brand-mark">T</span>
        <span>
          TutorPlatform
          <small>大学生家教撮合平台</small>
        </span>
      </NavLink>

      {isAuthenticated && <NotificationLink className="nav-notification-mobile" />}

      <button
        aria-controls="primary-navigation"
        aria-expanded={isMenuOpen}
        aria-label={isMenuOpen ? '关闭导航菜单' : '打开导航菜单'}
        className="nav-menu-button"
        onClick={() => setIsMenuOpen((current) => !current)}
        type="button"
      >
        <span />
        <span />
        <span />
      </button>

      <nav
        className={`app-nav ${isMenuOpen ? 'is-open' : ''}`}
        id="primary-navigation"
        aria-label="主导航"
      >
        <NavLink end to="/">首页</NavLink>
        {isAuthenticated ? (
          <>
            <NotificationLink className="nav-notification-desktop" />
            <NavLink className="nav-cta" to={getDashboardPath(user.role)}>
              {user.display_name || '我的'}控制台
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/login">登录</NavLink>
            <NavLink className="nav-cta" to="/register">免费注册</NavLink>
          </>
        )}
      </nav>
    </header>
  )
}

export default Navbar
