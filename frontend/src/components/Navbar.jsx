import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { getDashboardPath, getToken, getUser } from '../utils/auth.js'

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
          <NavLink className="nav-cta" to={getDashboardPath(user.role)}>
            {user.display_name || '我的'}控制台
          </NavLink>
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
