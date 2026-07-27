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
    icon: '△',
    title: '平台治理',
    description: '维护平台内容与撮合秩序。',
    to: '/admin/governance',
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

