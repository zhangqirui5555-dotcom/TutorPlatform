import {
  formatNotificationTime,
  notificationCategory,
  notificationDisplay,
} from '../utils/notificationFormat.js'

function NotificationCard({ busy, notification, onOpen, role }) {
  const isUnread = !notification.read_at
  const display = notificationDisplay(notification, role)

  return (
    <article className={`notification-card ${isUnread ? 'is-unread' : ''}`}>
      <button
        aria-label={`${isUnread ? '未读' : '已读'}通知：${display.title}`}
        disabled={busy}
        onClick={() => onOpen(notification)}
        type="button"
      >
        <span className="notification-card__indicator" aria-hidden="true" />
        <div className="notification-card__content">
          <header>
            <span className="notification-category">
              {notificationCategory(notification.type)}
            </span>
            <time dateTime={notification.created_at}>
              {formatNotificationTime(notification.created_at)}
            </time>
          </header>
          <h2>{display.title}</h2>
          <p>{display.body}</p>
          <footer>
            <span>{isUnread ? '未读' : '已读'}</span>
            <strong>{busy ? '正在打开…' : '查看详情'}</strong>
          </footer>
        </div>
      </button>
    </article>
  )
}

export default NotificationCard
