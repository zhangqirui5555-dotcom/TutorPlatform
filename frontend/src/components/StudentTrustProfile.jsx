function formatSubjects(subjects) {
  if (Array.isArray(subjects)) return subjects.filter(Boolean).join('、')
  return subjects || '暂未填写'
}

function formatDate(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

function TrustField({ label, value }) {
  return (
    <div className="student-trust-field">
      <dt>{label}</dt>
      <dd>{value || '暂未填写'}</dd>
    </div>
  )
}

function StudentTrustProfile({ reviews = [], reviewState = 'idle', student }) {
  const profile = student?.profile
  const ratedReviews = reviews.filter((review) => Number.isFinite(review.rating))
  const averageRating = ratedReviews.length
    ? ratedReviews.reduce((total, review) => total + review.rating, 0) / ratedReviews.length
    : null

  return (
    <section className="student-trust-profile" aria-label="学生信任信息">
      <div className="student-trust-profile__heading">
        <div>
          <p className="student-trust-profile__eyebrow">学生资料</p>
          <h3>学习与教学信息</h3>
        </div>
        <span className="student-trust-profile__privacy">不展示联系方式</span>
      </div>

      <dl className="student-trust-grid">
        <TrustField label="学校" value={profile?.school} />
        <TrustField label="专业" value={profile?.major} />
        <TrustField label="年级" value={profile?.grade} />
        <TrustField label="教授科目" value={formatSubjects(profile?.subjects)} />
      </dl>

      <div className="student-trust-detail">
        <h4>教学经验</h4>
        <p>{profile?.teaching_experience || '暂未填写教学经验。'}</p>
      </div>

      <div className="student-trust-detail">
        <h4>个人简介</h4>
        <p>{profile?.bio || '暂未填写个人简介。'}</p>
      </div>

      <div className="student-trust-verification">
        <div>
          <span>认证状态</span>
          <strong>当前状态未提供</strong>
        </div>
        <p>
          该学生已具备投递资格；当前认证状态与材料详情未由申请接口返回。
        </p>
      </div>

      <div className="student-trust-reviews">
        <div className="student-trust-profile__heading">
          <div>
            <p className="student-trust-profile__eyebrow">历史反馈</p>
            <h3>评价信息</h3>
          </div>
          {reviewState === 'ready' && averageRating !== null && (
            <strong className="student-trust-rating">
              {averageRating.toFixed(1)} / 5 · {ratedReviews.length} 条
            </strong>
          )}
        </div>

        {reviewState === 'loading' ? (
          <p className="student-trust-muted">正在加载历史评价…</p>
        ) : reviewState === 'unavailable' ? (
          <p className="student-trust-muted">历史评价暂时无法获取，不影响本次申请处理。</p>
        ) : reviews.length === 0 ? (
          <p className="student-trust-muted">暂无已完成试课后的历史评价。</p>
        ) : (
          <div className="student-trust-review-list">
            {reviews.slice(0, 2).map((review) => {
              const rating = Number.isInteger(review.rating)
                ? Math.max(0, Math.min(5, review.rating))
                : 0

              return (
                <article className="student-trust-review" key={review.id}>
                  <div>
                    <strong>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</strong>
                    <time>{formatDate(review.created_at)}</time>
                  </div>
                  <p>{review.content || '评价方未留下文字反馈。'}</p>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default StudentTrustProfile
