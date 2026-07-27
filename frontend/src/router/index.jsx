import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from '../App.jsx'
import ProtectedRoute from '../components/ProtectedRoute.jsx'
import RoleRoute from '../components/RoleRoute.jsx'
import AdminDashboardPage from '../pages/AdminDashboardPage.jsx'
import DashboardPage from '../pages/DashboardPage.jsx'
import HomePage from '../pages/HomePage.jsx'
import LoginPage from '../pages/LoginPage.jsx'
import ParentApplicationPage from '../pages/ParentApplicationPage.jsx'
import ParentDashboardPage from '../pages/ParentDashboardPage.jsx'
import ParentDemandCreatePage from '../pages/ParentDemandCreatePage.jsx'
import ParentDemandPage from '../pages/ParentDemandPage.jsx'
import ParentMessagePage from '../pages/ParentMessagePage.jsx'
import ParentReviewPage from '../pages/ParentReviewPage.jsx'
import ParentTrialLessonPage from '../pages/ParentTrialLessonPage.jsx'
import RegisterPage from '../pages/RegisterPage.jsx'
import StudentDashboardPage from '../pages/StudentDashboardPage.jsx'
import StudentApplicationPage from '../pages/StudentApplicationPage.jsx'
import StudentDemandDetailPage from '../pages/StudentDemandDetailPage.jsx'
import StudentDemandPage from '../pages/StudentDemandPage.jsx'
import StudentMessagePage from '../pages/StudentMessagePage.jsx'
import StudentProfilePage from '../pages/StudentProfilePage.jsx'
import StudentReviewPage from '../pages/StudentReviewPage.jsx'
import StudentTrialLessonPage from '../pages/StudentTrialLessonPage.jsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'parent/dashboard',
        element: (
          <RoleRoute allowedRole="PARENT">
            <ParentDashboardPage />
          </RoleRoute>
        ),
      },
      {
        path: 'parent/demands',
        element: (
          <RoleRoute allowedRole="PARENT">
            <ParentDemandPage />
          </RoleRoute>
        ),
      },
      {
        path: 'parent/demands/create',
        element: (
          <RoleRoute allowedRole="PARENT">
            <ParentDemandCreatePage />
          </RoleRoute>
        ),
      },
      {
        path: 'parent/demands/:id/applications',
        element: (
          <RoleRoute allowedRole="PARENT">
            <ParentApplicationPage />
          </RoleRoute>
        ),
      },
      {
        path: 'parent/messages',
        element: (
          <RoleRoute allowedRole="PARENT">
            <ParentMessagePage />
          </RoleRoute>
        ),
      },
      {
        path: 'parent/trial-lessons',
        element: (
          <RoleRoute allowedRole="PARENT">
            <ParentTrialLessonPage />
          </RoleRoute>
        ),
      },
      {
        path: 'parent/reviews',
        element: (
          <RoleRoute allowedRole="PARENT">
            <ParentReviewPage />
          </RoleRoute>
        ),
      },
      {
        path: 'student/dashboard',
        element: (
          <RoleRoute allowedRole="STUDENT">
            <StudentDashboardPage />
          </RoleRoute>
        ),
      },
      {
        path: 'student/demands',
        element: (
          <RoleRoute allowedRole="STUDENT">
            <StudentDemandPage />
          </RoleRoute>
        ),
      },
      {
        path: 'student/profile',
        element: (
          <RoleRoute allowedRole="STUDENT">
            <StudentProfilePage />
          </RoleRoute>
        ),
      },
      {
        path: 'student/applications',
        element: (
          <RoleRoute allowedRole="STUDENT">
            <StudentApplicationPage />
          </RoleRoute>
        ),
      },
      {
        path: 'student/demands/:id',
        element: (
          <RoleRoute allowedRole="STUDENT">
            <StudentDemandDetailPage />
          </RoleRoute>
        ),
      },
      {
        path: 'student/messages',
        element: (
          <RoleRoute allowedRole="STUDENT">
            <StudentMessagePage />
          </RoleRoute>
        ),
      },
      {
        path: 'student/trial-lessons',
        element: (
          <RoleRoute allowedRole="STUDENT">
            <StudentTrialLessonPage />
          </RoleRoute>
        ),
      },
      {
        path: 'student/reviews',
        element: (
          <RoleRoute allowedRole="STUDENT">
            <StudentReviewPage />
          </RoleRoute>
        ),
      },
      {
        path: 'admin/dashboard',
        element: (
          <RoleRoute allowedRole="ADMIN">
            <AdminDashboardPage />
          </RoleRoute>
        ),
      },
      {
        path: '*',
        element: <Navigate replace to="/dashboard" />,
      },
    ],
  },
])

export default router
