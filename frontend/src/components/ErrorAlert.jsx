function ErrorAlert({ message, onRetry }) {
  if (!message) return null

  return (
    <div className="notice notice-error error-alert" role="alert">
      <span aria-hidden="true">!</span>
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} type="button">重试</button>
      )}
    </div>
  )
}

export default ErrorAlert
