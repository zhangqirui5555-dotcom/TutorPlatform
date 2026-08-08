import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import client from '../api/client.js'
import { apiErrorMessage } from '../utils/apiError.js'
import { getDashboardPath, saveAuth } from '../utils/auth.js'

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await client.post('/auth/login', form)
      saveAuth(response.data.token, response.data.user)
      const returnPath = location.state?.from
      const safeReturnPath =
        typeof returnPath === 'string' &&
        returnPath.startsWith('/') &&
        !returnPath.startsWith('//')
          ? returnPath
          : null
      navigate(safeReturnPath || getDashboardPath(response.data.user.role), {
        replace: true,
      })
    } catch (requestError) {
      setError(apiErrorMessage(requestError, '登录失败，请稍后重试。'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-card">
      <div className="auth-heading">
        <p className="eyebrow">Welcome back</p>
        <h1>登录 TutorPlatform</h1>
        <p>继续管理家教需求、投递与试课安排。</p>
      </div>

      {location.state?.registered && (
        <div className="notice notice-success" role="status">
          注册成功，请使用新账号登录。
        </div>
      )}

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span>邮箱</span>
          <input
            autoComplete="email"
            name="email"
            onChange={updateField}
            placeholder="name@example.com"
            required
            type="email"
            value={form.email}
          />
        </label>

        <label>
          <span>密码</span>
          <input
            autoComplete="current-password"
            minLength="8"
            name="password"
            onChange={updateField}
            placeholder="至少 8 位"
            required
            type="password"
            value={form.password}
          />
        </label>

        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? '正在登录…' : '登录'}
        </button>
      </form>

      <p className="auth-footer">
        还没有账号？<Link to="/register">立即注册</Link>
      </p>
    </section>
  )
}

export default LoginPage
