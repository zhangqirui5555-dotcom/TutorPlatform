import { Link } from 'react-router-dom'

import { matchFlowPaths, resourcesFromAcceptResult } from '../utils/matchFlow.js'

const STEPS = [
  {
    key: 'order',
    number: '1',
    title: '确认课程金额',
    description: '请先确认本次家教服务的金额和基本安排。',
    action: '查看订单',
  },
  {
    key: 'messages',
    number: '2',
    title: '与学生沟通',
    description: '沟通授课时间、学习情况和具体教学安排。',
    action: '进入聊天',
  },
  {
    key: 'trials',
    number: '3',
    title: '安排试课',
    description: '双方沟通后，可以创建第一次试课安排。',
    action: '查看试课',
  },
]

function MatchSuccessDialog({ matchResult, onClose }) {
  if (!matchResult) return null

  const paths = matchFlowPaths(resourcesFromAcceptResult(matchResult), 'PARENT')

  return (
    <div className="match-success-modal" role="presentation">
      <section
        aria-labelledby="match-success-title"
        aria-modal="true"
        className="match-success-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="eyebrow">Match complete</p>
            <h2 id="match-success-title">匹配成功</h2>
            <p>你已选择该学生，平台已经为双方建立订单和沟通渠道。</p>
          </div>
          <button
            aria-label="关闭匹配成功引导"
            className="match-success-dialog__close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <ol className="match-success-steps">
          {STEPS.map((step) => (
            <li key={step.key}>
              <span className="match-success-step__number">步骤 {step.number}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
              <Link className="secondary-link-button" to={paths[step.key]}>
                {step.action}
              </Link>
            </li>
          ))}
        </ol>

        <footer>
          <button className="secondary-button" onClick={onClose} type="button">
            稍后再处理
          </button>
        </footer>
      </section>
    </div>
  )
}

export default MatchSuccessDialog
