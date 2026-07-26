import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDemands } from '../api/studentDemand.js'

function formatBudget(min, max) {
  const formatter = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  })
  return `${formatter.format(min / 100)} – ${formatter.format(max / 100)}/小时`
}

function StudentDemandPage() {
  const [filters, setFilters] = useState({
    subject: '',
    region: '',
  })
  const [activeFilters, setActiveFilters] = useState({})
  const [demands, setDemands] = useState([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const loadDemands = useCallback(async () => {
    setError('')
    setIsLoading(true)

    try {
      setDemands(await getDemands(activeFilters))
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          '需求大厅加载失败，请稍后重试。',
      )
    } finally {
      setIsLoading(false)
    }
  }, [activeFilters])

  useEffect(() => {
    loadDemands()
  }, [loadDemands])

  function updateFilter(event) {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function handleFilter(event) {
    event.preventDefault()
    setActiveFilters(filters)
  }

  function clearFilters() {
    setFilters({ subject: '', region: '' })
    setActiveFilters({})
  }

  return (
    <section className="student-demand-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Student · Opportunities</p>
          <h1>家教需求大厅</h1>
          <p>浏览正在招募大学生的家教需求，找到适合自己的机会。</p>
        </div>
        <Link className="secondary-link-button" to="/student/dashboard">
          返回控制台
        </Link>
      </header>

      <form className="filter-bar" onSubmit={handleFilter}>
        <label>
          <span>科目</span>
          <input
            name="subject"
            onChange={updateFilter}
            placeholder="例如：数学"
            value={filters.subject}
          />
        </label>
        <label>
          <span>区域</span>
          <input
            name="region"
            onChange={updateFilter}
            placeholder="例如：浦东新区"
            value={filters.region}
          />
        </label>
        <button className="primary-button compact-button" type="submit">
          筛选
        </button>
        <button
          className="text-button"
          onClick={clearFilters}
          type="button"
        >
          清除
        </button>
      </form>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="empty-state">正在加载公开需求…</div>
      ) : demands.length === 0 ? (
        <div className="empty-state">
          <h2>暂无匹配需求</h2>
          <p>调整科目或区域筛选条件后再试试。</p>
        </div>
      ) : (
        <>
          <p className="result-count">找到 {demands.length} 条招募中需求</p>
          <div className="opportunity-grid">
            {demands.map((demand) => (
              <article className="opportunity-card" key={demand.id}>
                <div className="opportunity-card-header">
                  <span>{demand.subject}</span>
                  <small>招募中</small>
                </div>
                <h2>{demand.title}</h2>
                <dl>
                  <div>
                    <dt>年级</dt>
                    <dd>{demand.child_grade}</dd>
                  </div>
                  <div>
                    <dt>区域</dt>
                    <dd>{demand.region}</dd>
                  </div>
                  <div>
                    <dt>预算</dt>
                    <dd>{formatBudget(demand.budget_min, demand.budget_max)}</dd>
                  </div>
                  <div>
                    <dt>时间</dt>
                    <dd>{demand.schedule_description}</dd>
                  </div>
                </dl>
                <Link
                  state={{ demand }}
                  to={`/student/demands/${demand.id}`}
                >
                  查看详情
                </Link>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

export default StudentDemandPage
