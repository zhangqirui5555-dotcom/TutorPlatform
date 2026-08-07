import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOrders } from '../api/order.js'
import EmptyState from '../components/EmptyState.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import LoadingState from '../components/LoadingState.jsx'
import OrderCard from '../components/OrderCard.jsx'
import {
  ORDER_STATUS_OPTIONS,
  orderErrorMessage,
} from '../utils/orderFormat.js'
import '../styles/order.css'

const PAGE_SIZE = 10

const PAGE_COPY = {
  PARENT: {
    eyebrow: '家长端 · 订单',
    title: '我的订单',
    description: '确认双方约定的服务金额，跟进试课和家教服务进度。',
  },
  STUDENT: {
    eyebrow: '学生端 · 订单',
    title: '我的订单',
    description: '确认服务金额，跟进沟通、试课和服务状态。',
  },
  ADMIN: {
    eyebrow: '管理端 · 订单',
    title: '订单管理',
    description: '查看平台订单、参与双方和当前履约状态。',
  },
}

function OrderListPage({ role }) {
  const copy = PAGE_COPY[role]
  const rolePath = role.toLowerCase()
  const [orders, setOrders] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: PAGE_SIZE,
    total: 0,
    total_pages: 0,
  })
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadOrders = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError('')

    try {
      const result = await getOrders({
        page,
        page_size: PAGE_SIZE,
        ...(status ? { status } : {}),
      })
      setOrders(result.orders || [])
      setPagination(result.pagination || {})
    } catch (requestError) {
      setError(orderErrorMessage(requestError, '订单列表加载失败，请稍后重试。'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page, status])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  function changeStatus(event) {
    setPage(1)
    setStatus(event.target.value)
  }

  return (
    <section className="order-page">
      <header className="workspace-header order-page__header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <Link className="secondary-link-button" to={`/${rolePath}/dashboard`}>
          返回控制台
        </Link>
      </header>

      <section aria-label="订单筛选" className="order-toolbar">
        <label>
          <span>订单状态</span>
          <select onChange={changeStatus} value={status}>
            <option value="">全部状态</option>
            {ORDER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <div className="order-toolbar__summary">
          共 <strong>{pagination.total || 0}</strong> 个订单
        </div>
        <button
          className="secondary-button"
          disabled={refreshing}
          onClick={() => loadOrders({ refresh: true })}
          type="button"
        >
          {refreshing ? '正在刷新…' : '刷新'}
        </button>
      </section>

      <ErrorAlert message={error} onRetry={loadOrders} />

      {loading ? (
        <LoadingState label="正在加载订单…" />
      ) : !error && orders.length === 0 ? (
        <EmptyState
          action={status ? (
            <button
              className="secondary-button"
              onClick={() => {
                setPage(1)
                setStatus('')
              }}
              type="button"
            >
              查看全部订单
            </button>
          ) : null}
          description={status ? '当前筛选条件下没有订单。' : '撮合成功后，订单会显示在这里。'}
          title="暂无订单"
        />
      ) : !error && (
        <div className="order-grid">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} role={role} />
          ))}
        </div>
      )}

      {!loading && !error && pagination.total_pages > 1 && (
        <nav aria-label="订单分页" className="pagination order-pagination">
          <button
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
            type="button"
          >
            上一页
          </button>
          <span>第 {page} / {pagination.total_pages} 页</span>
          <button
            disabled={page >= pagination.total_pages}
            onClick={() => setPage((current) => current + 1)}
            type="button"
          >
            下一页
          </button>
        </nav>
      )}
    </section>
  )
}

export default OrderListPage
