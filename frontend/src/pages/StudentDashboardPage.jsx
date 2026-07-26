import RoleDashboard from '../components/RoleDashboard.jsx'

const MODULES = [
  {
    icon: '◎',
    title: '个人资料',
    description: '完善简历并管理学生认证。',
  },
  {
    icon: '⌕',
    title: '浏览需求',
    description: '寻找适合自己的家教机会。',
    to: '/student/demands',
  },
  {
    icon: '↗',
    title: '我的投递',
    description: '跟踪投递、沟通和试课进度。',
    to: '/student/applications',
  },
  {
    icon: '✦',
    title: '站内消息',
    description: '与已撮合的家长沟通试课安排。',
    to: '/student/messages',
  },
  {
    icon: '◷',
    title: '试课预约',
    description: '创建预约并查看试课安排。',
    to: '/student/trial-lessons',
  },
  {
    icon: '★',
    title: '我的评价',
    description: '评价已完成的试课并查看收到的反馈。',
    to: '/student/reviews',
  },
]

function StudentDashboardPage() {
  return (
    <RoleDashboard
      eyebrow="Student workspace"
      modules={MODULES}
      title="大学生控制台"
      welcome="完善可信资料，浏览家教需求，并跟进每一次投递机会。"
    />
  )
}

export default StudentDashboardPage
