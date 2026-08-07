import RoleDashboard from '../components/RoleDashboard.jsx'

const MODULES = [
  {
    icon: '◇',
    title: '认证审核',
    description: '审核大学生提交的证明材料。',
    to: '/admin/certifications',
  },
  {
    icon: '◉',
    title: '用户概览',
    description: '查看平台用户与账号状态。',
    to: '/admin/users',
  },
  {
    icon: '▤',
    title: '需求运营',
    description: '管理需求上架、推荐与公开有效期。',
    to: '/admin/demands',
  },
  {
    icon: '△',
    title: '平台治理',
    description: '维护平台内容与撮合秩序。',
    to: '/admin/governance',
  },
  {
    icon: '订',
    title: '订单管理',
    description: '查看平台订单、参与双方和当前履约状态。',
    to: '/admin/orders',
  },
]

function AdminDashboardPage() {
  return (
    <RoleDashboard
      eyebrow="Admin workspace"
      modules={MODULES}
      title="管理员控制台"
      welcome="审核学生身份，维护平台账号与业务流程的可信运行。"
    />
  )
}

export default AdminDashboardPage

