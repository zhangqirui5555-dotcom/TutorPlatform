import { Link } from 'react-router-dom'

const STEPS = [
  ['01', '发布需求', '家长填写科目、时间、区域与预算。'],
  ['02', '认证投递', '认证大学生浏览需求并提交个人申请。'],
  ['03', '沟通试课', '双方完成撮合，在站内沟通并预约试课。'],
  ['04', '完成评价', '试课完成后双向评价，沉淀可信口碑。'],
]

function HomePage() {
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">TutorPlatform · Demo V1.0</p>
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
