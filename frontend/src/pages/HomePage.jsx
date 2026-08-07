import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getFeaturedDemands, getPublicDemands } from '../api/publicDemand.js'
import HomeDemandSection from '../components/HomeDemandSection.jsx'
import '../styles/homeDemand.css'

const STEPS = [
  ['01', '发布需求', '家长填写科目、时间、区域与预算。'],
  ['02', '认证投递', '认证大学生浏览需求并提交个人申请。'],
  ['03', '沟通试课', '双方完成撮合，在站内沟通并预约试课。'],
  ['04', '完成评价', '试课完成后双向评价，沉淀可信口碑。'],
]

function HomePage() {
  const [featuredDemands, setFeaturedDemands] = useState([])
  const [featuredError, setFeaturedError] = useState('')
  const [featuredLoading, setFeaturedLoading] = useState(true)
  const [latestDemands, setLatestDemands] = useState([])
  const [latestError, setLatestError] = useState('')
  const [latestLoading, setLatestLoading] = useState(true)
  const [latestLimit, setLatestLimit] = useState(6)

  const loadFeatured = useCallback(async () => {
    setFeaturedError('')
    setFeaturedLoading(true)
    try {
      const result = await getFeaturedDemands({ page: 1, page_size: 3 })
      setFeaturedDemands(result.demands || [])
    } catch (error) {
      setFeaturedError(error.message)
    } finally {
      setFeaturedLoading(false)
    }
  }, [])

  const loadLatest = useCallback(async (pageSize = 6) => {
    setLatestError('')
    setLatestLoading(true)
    try {
      const result = await getPublicDemands({ page: 1, page_size: pageSize })
      setLatestDemands(result.demands || [])
    } catch (error) {
      setLatestError(error.message)
    } finally {
      setLatestLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFeatured()
    loadLatest(6)
  }, [loadFeatured, loadLatest])

  function showMoreDemands() {
    setLatestLimit(20)
    loadLatest(20)
  }

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">TutorPlatform</p>
          <h1>找到合适的老师，<br /><span>让学习更进一步。</span></h1>
          <p className="hero-lead">
            连接有真实辅导需求的家庭与经过认证的大学生，
            从发布、筛选到试课评价，一站完成家教撮合。
          </p>
          <div className="hero-actions">
            <Link className="primary-link-button" to="/register">
              我是家长，发布需求
            </Link>
            <Link className="secondary-link-button" to="/register">
              我是学生，寻找机会
            </Link>
          </div>
          <div className="hero-trust">
            <span><strong>认证</strong> 学生身份审核</span>
            <span><strong>闭环</strong> 沟通到评价</span>
            <span><strong>透明</strong> 进度全程可见</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="平台撮合流程概览">
          <div className="match-orbit orbit-parent">
            <span>家</span>
            <div><strong>家长需求</strong><small>初中数学 · 周末</small></div>
          </div>
          <div className="match-center">
            <span>TP</span>
            <strong>智能撮合</strong>
          </div>
          <div className="match-orbit orbit-student">
            <span>学</span>
            <div><strong>认证学生</strong><small>数学专业 · 有经验</small></div>
          </div>
          <div className="match-success">✓ 已建立可信连接</div>
        </div>
      </section>

      <div className="home-demand-groups">
        <HomeDemandSection
          demands={featuredDemands}
          description="由平台运营审核并在有效推荐时间内展示，所有内容均经过脱敏。"
          emptyDescription="运营审核通过推荐需求后，将在这里展示。"
          emptyTitle="暂无推荐需求"
          error={featuredError}
          eyebrow="Featured opportunities"
          isLoading={featuredLoading}
          onRetry={loadFeatured}
          title="推荐家教需求"
        />

        <div id="latest-demands">
          <HomeDemandSection
            demands={latestDemands}
            description="浏览平台当前公开、招募中且未过期的家教机会。"
            emptyDescription="暂时没有通过审核的公开需求，请稍后再来看看。"
            emptyTitle="暂无公开需求"
            error={latestError}
            eyebrow="Latest opportunities"
            isLoading={latestLoading}
            onRetry={() => loadLatest(latestLimit)}
            title="最新家教需求"
          />
          {!latestError && !latestLoading && latestLimit < 20 && latestDemands.length >= 6 && (
            <div className="home-demand-more">
              <button onClick={showMoreDemands} type="button">查看更多需求</button>
            </div>
          )}
        </div>
      </div>

      <section className="audience-section">
        <article>
          <span className="audience-icon">家</span>
          <div>
            <p className="eyebrow">For parents</p>
            <h2>清晰发布，安心筛选</h2>
            <p>集中查看学生资料和自荐信息，接受合适人选后直接沟通试课。</p>
            <Link to="/register">进入家长端 →</Link>
          </div>
        </article>
        <article>
          <span className="audience-icon student-icon">学</span>
          <div>
            <p className="eyebrow">For students</p>
            <h2>展示专长，获得机会</h2>
            <p>完善个人资料与学生认证，筛选适合自己的家教需求并跟进进度。</p>
            <Link to="/register">进入学生端 →</Link>
          </div>
        </article>
      </section>

      <section className="process-section">
        <div className="section-heading">
          <p className="eyebrow">How it works</p>
          <h2>四步完成一次可信家教撮合</h2>
          <p>每个关键节点都有明确状态，让双方知道下一步该做什么。</p>
        </div>
        <div className="process-grid">
          {STEPS.map(([number, title, description]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default HomePage
