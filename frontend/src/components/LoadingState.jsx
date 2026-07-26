function LoadingState({ label = '正在加载…' }) {
  return (
    <div className="state-panel state-loading" role="status">
      <span className="loading-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export default LoadingState
