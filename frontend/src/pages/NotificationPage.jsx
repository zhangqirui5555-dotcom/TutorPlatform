import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notification.js'
import EmptyState from '../components/EmptyState.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import LoadingState from '../components/LoadingState.jsx'
import NotificationCard from '../components/NotificationCard.jsx'
import useNotification from '../contexts/useNotification.js'
import { getDashboardPath, getUser } from '../utils/auth.js'
import {
  notificationErrorMessage,
  notificationTarget,
} from '../utils/notificationFormat.js'
import '../styles/notification.css'

const PAGE_SIZE = 20

function NotificationPage() {
  const navigate = useNavigate()
  const user = getUser()
  const {
    clearUnreadCount,
    decrementUnreadCount,
    refreshUnreadCount,
    unreadCount,
  } = useNotification()
  const [notifications, setNotifications] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: PAGE_SIZE,
    total: 0,
    total_pages: 0,
  })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [openingId, setOpeningId] = useState(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const hasUnreadNotifications = unreadCount > 0
    || notifications.some((notification) => !notification.read_at)

  const loadNotifications = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const result = await getNotifications({ page, page_size: PAGE_SIZE })
      setNotifications(result.notifications || [])
      setPagination(result.pagination || {})
    } catch (requestError) {
      setError(notificationErrorMessage(
        requestError,
        '通知列表加载失败，请稍后重试。',
      ))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page])

  useEffect(() => {
    loadNotifications()
    refreshUnreadCount()
  }, [loadNotifications, refreshUnreadCount])

  async function openNotification(notification) {
    if (openingId || markingAll) return

    setActionError('')
    setOpeningId(notification.id)
    try {
      if (!notification.read_at) {
        const updated = await markNotificationRead(notification.id)
        setNotifications((current) => current.map((item) => (
          item.id === notification.id ? updated : item
        )))
        decrementUnreadCount()
      }

      const target = notificationTarget(notification, user?.role)
      if (!target) {
        setActionError('相关内容已不存在或无法访问。')
        return
      }
      navigate(target)
    } catch (requestError) {
      setActionError(notificationErrorMessage(requestError))
    } finally {
      setOpeningId(null)
    }
  }

  async function markAllRead() {
    if (markingAll || !hasUnreadNotifications) return

    setActionError('')
    setMarkingAll(true)
    try {
      const result = await markAllNotificationsRead()
      const readAt = result.read_at || new Date().toISOString()
      setNotifications((current) => current.map((notification) => ({
        ...notification,
        read_at: notification.read_at || readAt,
      })))
      clearUnreadCount()
    } catch (requestError) {
      setActionError(notificationErrorMessage(requestError))
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <section className="notification-page">
      <header className="workspace-header notification-page__header">
        <div>
          <p className="eyebrow">Notification center</p>
          <h1>通知中心</h1>
          <p>查看申请、订单、试课和站内消息提醒。</p>
        </div>
        <div className="notification-page__header-actions">
          <span className="notification-unread-summary">
            未读 <strong>{unreadCount}</strong>
          </span>
          <button
            className="primary-button"
            disabled={markingAll || !hasUnreadNotifications}
            onClick={markAllRead}
            type="button"
          >
            {markingAll ? '正在处理…' : '全部已读'}
          </button>
          <Link className="secondary-link-button" to={getDashboardPath(user?.role)}>
            返回控制台
          </Link>
        </div>
      </header>

      <div className="notification-toolbar">
        <p>共 <strong>{pagination.total || 0}</strong> 条通知</p>
        <button
          className="secondary-button"
          disabled={refreshing}
          onClick={() => {
            loadNotifications({ refresh: true })
            refreshUnreadCount()
          }}
          type="button"
        >
          {refreshing ? '正在刷新…' : '刷新通知'}
        </button>
      </div>

      <ErrorAlert message={actionError || error} onRetry={error ? loadNotifications : undefined} />

      {loading ? (
        <LoadingState label="正在加载通知…" />
      ) : !error && notifications.length === 0 ? (
        <EmptyState
          description="申请、订单、试课或消息有新进展时，会在这里提醒你。"
          title="暂无通知"
        />
      ) : !error && (
        <div className="notification-list">
          {notifications.map((notification) => (
            <NotificationCard
              busy={openingId === notification.id}
              key={notification.id}
              notification={notification}
              onOpen={openNotification}
              role={user?.role}
            />
          ))}
        </div>
      )}

      {!loading && !error && pagination.total_pages > 1 && (
        <nav aria-label="通知分页" className="pagination notification-pagination">
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

export default NotificationPage
