import { Outlet } from 'react-router-dom'
import Footer from './components/Footer.jsx'
import Navbar from './components/Navbar.jsx'
import NotificationProvider from './contexts/NotificationProvider.jsx'
import './App.css'
import './styles/mobile.css'
import './styles/notification.css'

function App() {
  return (
    <NotificationProvider>
      <div className="app-shell">
        <Navbar />
        <main className="app-main">
          <Outlet />
        </main>
        <Footer />
      </div>
    </NotificationProvider>
  )
}

export default App
