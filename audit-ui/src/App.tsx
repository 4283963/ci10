import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import AuditDashboard from './pages/AuditDashboard'

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AuditDashboard />} />
        <Route path="/audit" element={<AuditDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
