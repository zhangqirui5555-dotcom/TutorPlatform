import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client.js'
import { apiErrorMessage } from '../utils/apiError.js'

function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    password: '',
    display_name: '',
    role: 'PARENT',
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
      await client.post('/auth/register', form)
      navigate('/login', {
        replace: true,
        state: { registered: true },
      })
    } catch (requestError) {
      setError(apiErrorMessage(requestError, '注册失败，请稍后重试。'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-card">
      <div className="auth-heading">
        <p className="eyebrow">Create account</p>
        <h1>加入 TutorPlatform</h1>
        <p>选择身份并创建账号，开启家教撮合流程。</p>
      </div>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span>显示名称</span>
          <input
            autoComplete="name"
            name="display_name"
            onChange={updateField}
            placeholder="请输入姓名或称呼"
            required
            value={form.display_name}
          />
        </label>

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
            autoComplete="new-password"
            minLength="8"
            name="password"
            onChange={updateField}
            placeholder="至少 8 位"
            required
            type="password"
            value={form.password}
          />
        </label>

        <fieldset className="role-fieldset">
          <legend>注册身份</legend>
          <label className="role-option">
            <input
              checked={form.role === 'PARENT'}
              name="role"
              onChange={updateField}
              type="radio"
              value="PARENT"
            />
            <span>
              <strong>家长</strong>
              <small>发布需求并筛选大学生</small>
            </span>
          </label>
          <label className="role-option">
            <input
              checked={form.role === 'STUDENT'}
              name="role"
              onChange={updateField}
              type="radio"
              value="STUDENT"
            />
            <span>
              <strong>大学生</strong>
              <small>完善资料并投递家教需求</small>
            </span>
          </label>
        </fieldset>

        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? '正在注册…' : '创建账号'}
        </button>
      </form>

      <p className="auth-footer">
        已有账号？<Link to="/login">返回登录</Link>
      </p>
    </section>
  )
}

export default RegisterPage
