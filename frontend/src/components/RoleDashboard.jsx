import { Link, useNavigate } from 'react-router-dom'
import { clearAuth, getUser } from '../utils/auth.js'

function RoleDashboard({ eyebrow, title, welcome, modules }) {
  const navigate = useNavigate()
  const user = getUser()

  function handleLogout() {
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <section className="role-dashboard">
      <header className="role-dashboard-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>
            {user?.display_name} · {user?.role}
          </p>
        </div>
        <button className="secondary-button" onClick={handleLogout} type="button">
          退出登录
        </button>
      </header>

      <div className="welcome-panel">
        <div className="user-badge">{user?.display_name?.slice(0, 1) || 'T'}</div>
        <div>
          <h2>你好，{user?.display_name || 'TutorPlatform 用户'}</h2>
          <p>{welcome}</p>
        </div>
      </div>

      <div className="module-grid">
        {modules.map((module) => (
          <article className="module-card" key={module.title}>
            <span aria-hidden="true">{module.icon}</span>
            <h2>{module.title}</h2>
            <p>{module.description}</p>
            {module.to ? (
              <Link className="module-link" to={module.to}>
                进入模块
              </Link>
            ) : (
              <small>功能将在后续阶段接入</small>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

export default RoleDashboard
