import RoleDashboard from '../components/RoleDashboard.jsx'

const MODULES = [
  {
    icon: '⌁',
    title: '我的需求',
    description: '创建、发布和管理家教需求。',
    to: '/parent/demands',
  },
  {
    icon: '✓',
    title: '投递筛选',
    description: '查看大学生投递并完成撮合。',
  },
  {
    icon: '◷',
    title: '试课安排',
    description: '管理沟通、试课和评价进度。',
    to: '/parent/trial-lessons',
  },
  {
    icon: '✦',
    title: '站内消息',
    description: '与已接受的学生进行站内沟通。',
    to: '/parent/messages',
  },
  {
    icon: '★',
    title: '我的评价',
    description: '评价已完成的试课并查看收到的反馈。',
    to: '/parent/reviews',
  },
]

function ParentDashboardPage() {
  return (
    <RoleDashboard
      eyebrow="Parent workspace"
      modules={MODULES}
      title="家长控制台"
      welcome="从发布需求到确认试课，在这里管理完整的家教撮合流程。"
    />
  )
}

export default ParentDashboardPage
