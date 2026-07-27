import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getMyStudentProfile,
  saveMyStudentProfile,
} from '../api/studentProfile.js'

const INITIAL_FORM = {
  school: '',
  major: '',
  grade: '',
  subjects: '',
  teaching_experience: '',
  bio: '',
  expected_price_min: '',
  expected_price_max: '',
  teaching_regions: '',
}

function listToText(value) {
  return Array.isArray(value) ? value.join('、') : ''
}

function textToList(value) {
  return value
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function centsToYuan(value) {
  return value === null || value === undefined ? '' : value / 100
}

function yuanToCents(value) {
  return value === '' ? null : Math.round(Number(value) * 100)
}

function StudentProfilePage() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true

    getMyStudentProfile()
      .then((profile) => {
        if (!active) return
        setForm({
          school: profile.school || '',
          major: profile.major || '',
          grade: profile.grade || '',
          subjects: listToText(profile.subjects),
          teaching_experience: profile.teaching_experience || '',
          bio: profile.bio || '',
          expected_price_min: centsToYuan(profile.expected_price_min),
          expected_price_max: centsToYuan(profile.expected_price_max),
          teaching_regions: listToText(profile.teaching_regions),
        })
      })
      .catch((requestError) => {
        if (requestError.response?.status !== 404 && active) {
          setError('个人资料加载失败，请稍后重试。')
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const minimumPrice = yuanToCents(form.expected_price_min)
    const maximumPrice = yuanToCents(form.expected_price_max)

    if (
      minimumPrice !== null &&
      maximumPrice !== null &&
      minimumPrice > maximumPrice
    ) {
      setError('最低期望课时费不能高于最高期望课时费。')
      return
    }

    setIsSubmitting(true)

    try {
      await saveMyStudentProfile({
        school: form.school,
        major: form.major,
        grade: form.grade,
        subjects: textToList(form.subjects),
        teaching_experience: form.teaching_experience,
        bio: form.bio,
        expected_price_min: minimumPrice,
        expected_price_max: maximumPrice,
        teaching_regions: textToList(form.teaching_regions),
      })
      setSuccess('个人资料已保存。')
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          '个人资料保存失败，请检查填写内容。',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="demand-form-card">
      <header className="form-page-header">
        <div>
          <p className="eyebrow">Student profile</p>
          <h1>完善个人资料</h1>
          <p>填写学校、专业和辅导能力，保存后家长可在投递中查看。</p>
        </div>
        <Link to="/student/dashboard">返回控制台</Link>
      </header>

      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {success && <div className="notice notice-success" role="status">{success}</div>}

      {isLoading ? (
        <div className="empty-state">正在加载个人资料…</div>
      ) : (
        <form className="demand-form" onSubmit={handleSubmit}>
          <label>
            <span>学校</span>
            <input name="school" onChange={updateField} placeholder="例如：Demo大学" required value={form.school} />
          </label>
          <label>
            <span>专业</span>
            <input name="major" onChange={updateField} placeholder="例如：数学与应用数学" required value={form.major} />
          </label>
          <label>
            <span>年级</span>
            <input name="grade" onChange={updateField} placeholder="例如：大三" required value={form.grade} />
          </label>
          <label>
            <span>擅长科目</span>
            <input name="subjects" onChange={updateField} placeholder="数学、英语（用逗号分隔）" required value={form.subjects} />
          </label>
          <label>
            <span>最低期望课时费（元/小时）</span>
            <input min="0" name="expected_price_min" onChange={updateField} placeholder="80" step="0.01" type="number" value={form.expected_price_min} />
          </label>
          <label>
            <span>最高期望课时费（元/小时）</span>
            <input min="0" name="expected_price_max" onChange={updateField} placeholder="120" step="0.01" type="number" value={form.expected_price_max} />
          </label>
          <label className="full-field">
            <span>可授课地区</span>
            <input name="teaching_regions" onChange={updateField} placeholder="浦东新区、线上（用逗号分隔）" required value={form.teaching_regions} />
          </label>
          <label className="full-field">
            <span>辅导经历</span>
            <textarea name="teaching_experience" onChange={updateField} placeholder="简要说明辅导年级、科目与经验" rows="4" value={form.teaching_experience} />
          </label>
          <label className="full-field">
            <span>个人简介</span>
            <textarea name="bio" onChange={updateField} placeholder="介绍自己的教学特点与可用时间" rows="4" value={form.bio} />
          </label>
          <div className="form-actions full-field">
            <Link className="secondary-link-button" to="/student/dashboard">取消</Link>
            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? '正在保存…' : '保存个人资料'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

export default StudentProfilePage
