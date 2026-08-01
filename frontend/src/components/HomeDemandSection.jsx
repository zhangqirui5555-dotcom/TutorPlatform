import EmptyState from './EmptyState.jsx'
import ErrorAlert from './ErrorAlert.jsx'
import LoadingState from './LoadingState.jsx'
import PublicDemandCard from './PublicDemandCard.jsx'

function HomeDemandSection({
  demands,
  description,
  emptyDescription,
  emptyTitle,
  error,
  eyebrow,
  isLoading,
  onRetry,
  title,
}) {
  return (
    <section className="home-demand-section">
      <div className="home-demand-section__heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      <ErrorAlert message={error} onRetry={onRetry} />

      {isLoading ? (
        <LoadingState label="正在加载家教需求…" />
      ) : !error && demands.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : demands.length > 0 ? (
        <div className="home-demand-grid">
          {demands.map((demand) => (
            <PublicDemandCard demand={demand} key={demand.id} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export default HomeDemandSection
