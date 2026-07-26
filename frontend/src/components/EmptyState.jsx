function EmptyState({ title = '暂无内容', description, action }) {
  return (
    <div className="state-panel state-empty">
      <span className="state-icon" aria-hidden="true">◇</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}

export default EmptyState
