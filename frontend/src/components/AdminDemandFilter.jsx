function AdminDemandFilter({ filters, onChange, onReset, onSubmit }) {
  const update = (event) => onChange({ ...filters, [event.target.name]: event.target.value })

  return (
    <form className="admin-demand-filter" onSubmit={onSubmit}>
      <label><span>搜索</span><input name="search" onChange={update} placeholder="标题、家长姓名或邮箱" value={filters.search} /></label>
      <label><span>业务状态</span><select name="status" onChange={update} value={filters.status}><option value="">全部</option><option value="DRAFT">草稿</option><option value="RECRUITING">招募中</option><option value="MATCHED">已匹配</option><option value="COMPLETED">已完成</option><option value="CLOSED">已关闭</option></select></label>
      <label><span>公开状态</span><select name="visibility_status" onChange={update} value={filters.visibility_status}><option value="">全部</option><option value="VISIBLE">已上架</option><option value="HIDDEN">已下架</option></select></label>
      <label><span>推荐</span><select name="is_featured" onChange={update} value={filters.is_featured}><option value="">全部</option><option value="true">已推荐</option><option value="false">未推荐</option></select></label>
      <label><span>科目</span><input name="subject" onChange={update} placeholder="例如 MATH" value={filters.subject} /></label>
      <label><span>区域</span><input name="region" onChange={update} placeholder="区域关键词" value={filters.region} /></label>
      <label><span>有效期</span><select name="expired" onChange={update} value={filters.expired}><option value="">全部</option><option value="false">有效</option><option value="true">已过期</option></select></label>
      <div className="admin-demand-filter__actions"><button className="primary-button" type="submit">查询</button><button className="secondary-button" onClick={onReset} type="button">重置筛选</button></div>
    </form>
  )
}

export default AdminDemandFilter
