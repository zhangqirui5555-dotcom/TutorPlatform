import { useEffect, useState } from 'react'
import {
  centsToYuanInput,
  formatMoney,
  formatPlatformFee,
  yuanInputToCents,
} from '../utils/orderFormat.js'

function OrderActionDialog({ action, busy, error, onClose, onSubmit, order }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    setAmount(centsToYuanInput(order?.total_amount))
    setReason('')
    setValidationError('')
  }, [action, order])

  if (!action) return null

  const copy = {
    terms: {
      title: '确认服务金额',
      description: '请填写你与学生沟通确认的本次家教服务金额。当前平台仅记录双方约定，不会在此页面扣款。',
      submit: '确认服务金额',
      cancel: '取消',
    },
    confirm: {
      title: '确认订单',
      description: `请确认服务金额 ${formatMoney(order.total_amount, order.currency)} 与你和家长沟通的结果一致。确认后订单将进入服务阶段。`,
      submit: '确认订单并开始服务',
      cancel: '取消',
    },
    complete: {
      title: '确认完成订单？',
      description: '确认后，本次家教服务将标记为已完成，并进入评价阶段。',
      submit: '确认完成',
      cancel: '取消',
    },
    cancel: {
      title: '取消订单',
      description: '取消后无法恢复，请填写真实、清晰的取消原因。',
      submit: '确认取消',
      cancel: '返回',
    },
  }[action]

  function submit(event) {
    event.preventDefault()
    setValidationError('')

    if (action === 'terms') {
      const totalAmount = yuanInputToCents(amount)
      if (totalAmount === null) {
        setValidationError('请输入大于0且最多保留两位小数的金额。')
        return
      }
      onSubmit({ total_amount: totalAmount, currency: order?.currency || 'CNY' })
      return
    }

    if (action === 'cancel') {
      const normalizedReason = reason.trim()
      if (!normalizedReason) {
        setValidationError('请填写取消原因。')
        return
      }
      if (normalizedReason.length > 500) {
        setValidationError('取消原因不能超过500个字符。')
        return
      }
      onSubmit({ cancellation_reason: normalizedReason })
      return
    }

    onSubmit({})
  }

  const amountInCents = action === 'terms' ? yuanInputToCents(amount) : null

  return (
    <div
      className="order-modal"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}
      role="presentation"
    >
      <section
        aria-labelledby="order-dialog-title"
        aria-modal="true"
        className="order-dialog"
        role="dialog"
      >
        <header>
          <div>
            <p className="eyebrow">订单操作</p>
            <h2 id="order-dialog-title">{copy.title}</h2>
            <p>{copy.description}</p>
          </div>
          <button
            aria-label="关闭对话框"
            className="order-dialog__close"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <form onSubmit={submit}>
          {action === 'terms' && (
            <>
              <label>
                <span>服务金额（元）</span>
                <input
                  autoFocus
                  inputMode="decimal"
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="例如：3000"
                  required
                  value={amount}
                />
                <small>请填写双方已经沟通确认的金额。</small>
              </label>
              <div className="order-amount-preview" aria-live="polite">
                <span>金额预览</span>
                <strong>
                  {amountInCents === null ? '请输入有效金额' : formatMoney(amountInCents, 'CNY')}
                </strong>
                <small>人民币元</small>
              </div>
              <div className="order-fee-readonly">
                <span>平台服务费</span>
                <strong>{formatPlatformFee(order?.platform_fee, order?.currency)}</strong>
                <small>
                  {Number.isSafeInteger(order?.platform_fee)
                    ? '平台服务费由平台规则维护，家长无需填写。'
                    : '当前平台尚未设置服务费，家长无需填写。'}
                </small>
              </div>
            </>
          )}

          {action === 'cancel' && (
            <label>
              <span>取消原因</span>
              <textarea
                autoFocus
                maxLength="500"
                onChange={(event) => setReason(event.target.value)}
                placeholder="请说明取消订单的原因"
                required
                rows="5"
                value={reason}
              />
              <small>{reason.length}/500</small>
            </label>
          )}

          {(validationError || error) && (
            <p className="field-error" role="alert">{validationError || error}</p>
          )}

          <div className="order-dialog__actions">
            <button className="secondary-button" disabled={busy} onClick={onClose} type="button">
              {copy.cancel}
            </button>
            <button
              className={action === 'cancel' ? 'danger-button' : 'primary-button'}
              disabled={busy}
              type="submit"
            >
              {busy ? '正在提交…' : copy.submit}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default OrderActionDialog
