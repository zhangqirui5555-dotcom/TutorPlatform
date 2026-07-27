import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  closeGovernanceDemand,
  getGovernanceOverview,
  reopenGovernanceDemand,
} from '../api/admin.js'
import EmptyState from '../components/EmptyState.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import LoadingState from '../components/LoadingState.jsx'

const STATUS_LABELS = {
  DRAFT: '鑽夌',
  RECRUITING: '鎷涘嫙涓?,
  MATCHED: '宸插尮閰?,
  COMPLETED: '宸插畬鎴?,
  CLOSED: '宸插叧闂?,
}

function AdminGovernancePage() {
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  const loadOverview = useCallback(async () => {
    setError('')
    try {
      setOverview(await getGovernanceOverview())
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || '骞冲彴鏁版嵁鍔犺浇澶辫触銆?)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  async function closeDemand(demand) {
    if (!window.confirm(`纭鍏抽棴闇€姹傗€?{demand.title}鈥濆悧锛熷叧闂悗瀛︾敓灏嗘棤娉曠户缁姇閫掋€俙)) {
      return
    }

    setUpdatingId(demand.id)
    setError('')
    try {
      await closeGovernanceDemand(demand.id)
      await loadOverview()
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || '闇€姹傚叧闂け璐ャ€?)
    } finally {
      setUpdatingId(null)
    }
  }

  async function reopenDemand(demand) {
    if (!window.confirm(`纭鎭㈠闇€姹傗€?{demand.title}鈥濆悧锛熸仮澶嶅悗灏嗛噸鏂板厑璁稿鐢熸祻瑙堝拰鎶曢€掋€俙)) {
      return
    }

    setUpdatingId(demand.id)
    setError('')
    try {
      await reopenGovernanceDemand(demand.id)
      await loadOverview()
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || '闇€姹傛仮澶嶅け璐ャ€?)
    } finally {
      setUpdatingId(null)
    }
  }

  const metrics = overview?.metrics

  return (
    <section className="admin-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Admin 路 Governance</p>
          <h1>骞冲彴娌荤悊</h1>
          <p>鏌ョ湅鍏抽敭涓氬姟鏁版嵁锛屽苟缁存姢鍏紑瀹舵暀闇€姹傜殑姝ｅ父绉╁簭銆?/p>
        </div>
        <Link className="secondary-link-button" to="/admin/dashboard">杩斿洖鎺у埗鍙?/Link>
      </header>

      <ErrorAlert message={error} onRetry={loadOverview} />

      {isLoading ? (
        <LoadingState label="姝ｅ湪鍔犺浇骞冲彴鏁版嵁鈥? />
      ) : !overview ? (
        <EmptyState
          title="骞冲彴鏁版嵁鏆傛椂涓嶅彲鐢?
          description="鍚庣鏈嶅姟鍙兘浠嶅湪閮ㄧ讲锛岃绋嶅悗鐐瑰嚮涓婃柟閲嶈瘯銆?
        />
      ) : (
        <>
          <div className="metric-grid">
            <article><span>骞冲彴鐢ㄦ埛</span><strong>{metrics.total_users}</strong><small>{metrics.active_users} 涓甯歌处鍙?/small></article>
            <article><span>瀹堕暱 / 瀛︾敓</span><strong>{metrics.parents} / {metrics.students}</strong><small>{metrics.suspended_users} 涓仠鐢ㄨ处鍙?/small></article>
            <article><span>鎷涘嫙涓渶姹?/span><strong>{metrics.recruiting_demands}</strong><small>{metrics.matched_demands} 涓凡鍖归厤</small></article>
            <article><span>绱鎶曢€?/span><strong>{metrics.applications}</strong><small>{metrics.active_conversations} 涓椿璺冧細璇?/small></article>
            <article><span>寰呭璁よ瘉</span><strong>{metrics.pending_certifications}</strong><small>{metrics.completed_demands} 涓渶姹傚凡瀹屾垚</small></article>
          </div>

          <section className="governance-section">
            <div className="section-heading">
              <div><h2>闇€姹傚唴瀹圭鐞?/h2><p>鏈€澶氭樉绀烘渶杩?50 鏉￠渶姹傘€?/p></div>
              <button className="secondary-button compact-button" onClick={loadOverview} type="button">鍒锋柊鏁版嵁</button>
            </div>
            {overview.demands.length === 0 ? (
              <EmptyState title="鏆傛棤瀹舵暀闇€姹? description="瀹堕暱鍙戝竷闇€姹傚悗浼氭樉绀哄湪杩欓噷銆? />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>闇€姹?/th><th>鍙戝竷鑰?/th><th>鍦板尯</th><th>鎶曢€?/th><th>鐘舵€?/th><th>娌荤悊鎿嶄綔</th></tr></thead>
                  <tbody>
                    {overview.demands.map((demand) => (
                      <tr key={demand.id}>
                        <td><strong>{demand.title}</strong><small>{demand.subject}</small></td>
                        <td><strong>{demand.parent.display_name}</strong><small>{demand.parent.email}</small></td>
                        <td>{demand.region}</td>
                        <td>{demand.application_count}</td>
                        <td><span className={`status-tag status-${demand.status.toLowerCase()}`}>{STATUS_LABELS[demand.status] || demand.status}</span></td>
                        <td>
                          {['DRAFT', 'RECRUITING'].includes(demand.status) ? (
                            <button
                              className="secondary-button compact-button danger-button"
                              disabled={updatingId === demand.id}
                              onClick={() => closeDemand(demand)}
                              type="button"
                            >
                              {updatingId === demand.id ? '澶勭悊涓€? : '鍏抽棴闇€姹?}
                            </button>
                          ) : demand.status === 'CLOSED' ? (
                            <button
                              className="secondary-button compact-button"
                              disabled={updatingId === demand.id}
                              onClick={() => reopenDemand(demand)}
                              type="button"
                            >
                              {updatingId === demand.id ? '澶勭悊涓€? : '鎭㈠闇€姹?}
                            </button>
                          ) : <span className="muted-text">鏃犻渶澶勭悊</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}

export default AdminGovernancePage

