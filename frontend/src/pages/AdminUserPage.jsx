import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminUsers, updateAdminUserStatus } from '../api/admin.js'
import EmptyState from '../components/EmptyState.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import LoadingState from '../components/LoadingState.jsx'
import '../styles/adminMobile.css'

const ROLE_LABELS = { ADMIN: '管理员', PARENT: '家长', STUDENT: '大学生' }

function formatTime(value) {
  return value ? new Date(value).toLocaleString('zh-CN') : '暂无记录'
}

function UserStatusAction({ user, updatingId, onToggle }) {
  if (user.role === 'ADMIN') return <span className="muted-text">受保护</span>

  return (
    <button
      className="secondary-button compact-button"
      disabled={updatingId === user.id}
      onClick={() => onToggle(user)}
      type="button"
    >
      {updatingId === user.id ? '处理中…' : user.status === 'ACTIVE' ? '停用账号' : '恢复账号'}
    </button>
  )
}

function AdminUserCard({ user, updatingId, onToggle }) {
  const statusLabel = user.status === 'ACTIVE' ? '正常' : '已停用'

  return (
    <article className="admin-operation-card admin-user-card">
      <header className="admin-operation-card__header">
        <div>
          <h2>{user.display_name}</h2>
          <p>{user.email || '未填写邮箱'}</p>
        </div>
        <span className={`status-tag status-${user.status.toLowerCase()}`}>{statusLabel}</span>
      </header>
      <dl className="admin-operation-card__details">
        <div className="admin-operation-card__field">
          <dt>角色</dt>
          <dd>{ROLE_LABELS[user.role] || user.role}</dd>
        </div>
        <div className="admin-operation-card__field">
          <dt>最近登录</dt>
          <dd>{formatTime(user.last_login_at)}</dd>
        </div>
        <div className="admin-operation-card__field">
          <dt>注册时间</dt>
          <dd>{formatTime(user.created_at)}</dd>
        </div>
      </dl>
      <footer className="admin-operation-card__actions">
        <UserStatusAction user={user} updatingId={updatingId} onToggle={onToggle} />
      </footer>
    </article>
  )
}

function AdminUserPage() {
  const [users, setUsers] = useState([])
  const [filters, setFilters] = useState({ role: '', status: '', search: '' })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  const loadUsers = useCallback(async (nextFilters = filters) => {
    setError('')
    try {
      setUsers(await getAdminUsers(nextFilters))
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || '用户列表加载失败。')
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadUsers()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function submitFilters(event) {
    event.preventDefault()
    setIsLoading(true)
    await loadUsers(filters)
  }

  async function toggleStatus(user) {
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    setUpdatingId(user.id)
    setError('')
    try {
      await updateAdminUserStatus(user.id, nextStatus)
      await loadUsers(filters)
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || '账号状态更新失败。')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <section className="admin-workspace admin-operations-page admin-user-page">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Admin · Users</p>
          <h1>用户概览</h1>
          <p>查看平台账号、角色和状态，并管理异常账号。</p>
        </div>
        <Link className="secondary-link-button" to="/admin/dashboard">返回控制台</Link>
      </header>

      <form className="admin-filter-bar" onSubmit={submitFilters}>
        <label>
          <span>搜索</span>
          <input
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            placeholder="姓名或邮箱"
            value={filters.search}
          />
        </label>
        <label>
          <span>角色</span>
          <select
            onChange={(event) => setFilters({ ...filters, role: event.target.value })}
            value={filters.role}
          >
            <option value="">全部角色</option>
            <option value="PARENT">家长</option>
            <option value="STUDENT">大学生</option>
            <option value="ADMIN">管理员</option>
          </select>
        </label>
        <label>
          <span>状态</span>
          <select
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            value={filters.status}
          >
            <option value="">全部状态</option>
            <option value="ACTIVE">正常</option>
            <option value="SUSPENDED">已停用</option>
          </select>
        </label>
        <button className="primary-button compact-button" type="submit">查询</button>
      </form>

      <ErrorAlert message={error} onRetry={() => loadUsers(filters)} />

      {isLoading ? (
        <LoadingState label="正在加载用户…" />
      ) : users.length === 0 ? (
        <EmptyState title="没有符合条件的用户" description="请调整筛选条件后重试。" />
      ) : (
        <>
          <div className="admin-table-wrap admin-desktop-table">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>注册时间</th>
                  <th>最近登录</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.display_name}</strong><small>{user.email}</small></td>
                    <td>{ROLE_LABELS[user.role] || user.role}</td>
                    <td><span className={`status-tag status-${user.status.toLowerCase()}`}>{user.status === 'ACTIVE' ? '正常' : '已停用'}</span></td>
                    <td>{formatTime(user.created_at)}</td>
                    <td>{formatTime(user.last_login_at)}</td>
                    <td>
                      <UserStatusAction
                        onToggle={toggleStatus}
                        updatingId={updatingId}
                        user={user}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-mobile-list">
            {users.map((user) => (
              <AdminUserCard
                key={user.id}
                onToggle={toggleStatus}
                updatingId={updatingId}
                user={user}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

export default AdminUserPage

