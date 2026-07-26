import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createDemand } from '../api/demand.js'

const INITIAL_FORM = {
  title: '',
  child_grade: '',
  subject: '',
  region: '',
  schedule_description: '',
  budget_min: '',
  budget_max: '',
  description: '',
}

function yuanToCents(value) {
  return Math.round(Number(value) * 100)
}

function ParentDemandCreatePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(INITIAL_FORM)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const budgetMin = yuanToCents(form.budget_min)
    const budgetMax = yuanToCents(form.budget_max)

    if (budgetMin > budgetMax) {
      setError('最低预算不能高于最高预算。')
      return
    }

    setIsSubmitting(true)

    try {
      await createDemand({
        ...form,
        budget_min: budgetMin,
        budget_max: budgetMax,
      })
      navigate('/parent/demands', {
        replace: true,
        state: { created: true },
      })
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          '需求创建失败，请检查填写内容。',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="demand-form-card">
      <header className="form-page-header">
        <div>
          <p className="eyebrow">New demand</p>
          <h1>创建家教需求</h1>
          <p>填写基础信息后将保存为草稿，你可以在列表中确认并发布。</p>
        </div>
        <Link to="/parent/demands">返回列表</Link>
      </header>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      <form className="demand-form" onSubmit={handleSubmit}>
        <label className="full-field">
          <span>需求标题</span>
          <input
            name="title"
            onChange={updateField}
            placeholder="例如：初二数学周末家教"
            required
            value={form.title}
          />
        </label>

        <label>
          <span>孩子年级</span>
          <input
            name="child_grade"
            onChange={updateField}
            placeholder="例如：初二"
            required
            value={form.child_grade}
          />
        </label>

        <label>
          <span>辅导科目</span>
          <input
            name="subject"
            onChange={updateField}
            placeholder="例如：数学"
            required
            value={form.subject}
          />
        </label>

        <label>
          <span>授课区域</span>
          <input
            name="region"
            onChange={updateField}
            placeholder="例如：浦东新区"
            required
            value={form.region}
          />
        </label>

        <label>
          <span>期望时间</span>
          <input
            name="schedule_description"
            onChange={updateField}
            placeholder="例如：周六下午"
            required
            value={form.schedule_description}
          />
        </label>

        <label>
          <span>最低预算（元/小时）</span>
          <input
            min="0"
            name="budget_min"
            onChange={updateField}
            placeholder="100"
            required
            step="0.01"
            type="number"
            value={form.budget_min}
          />
        </label>

        <label>
          <span>最高预算（元/小时）</span>
          <input
            min="0"
            name="budget_max"
            onChange={updateField}
            placeholder="180"
            required
            step="0.01"
            type="number"
            value={form.budget_max}
          />
        </label>

        <label className="full-field">
          <span>补充说明</span>
          <textarea
            name="description"
            onChange={updateField}
            placeholder="描述学习情况、教学偏好等信息"
            rows="5"
            value={form.description}
          />
        </label>

        <div className="form-actions full-field">
          <Link className="secondary-link-button" to="/parent/demands">
            取消
          </Link>
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? '正在保存…' : '保存草稿'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default ParentDemandCreatePage
