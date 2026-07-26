import { Outlet } from 'react-router-dom'
import Footer from './components/Footer.jsx'
import Navbar from './components/Navbar.jsx'
import './App.css'

function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default App
