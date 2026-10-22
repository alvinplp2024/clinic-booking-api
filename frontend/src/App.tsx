import { useState } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import type { Page } from './components/layout/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { BookAppointment } from './pages/BookAppointment'
import { Appointments } from './pages/Appointments'
import { DoctorAvailability } from './pages/DoctorAvailability'
import { ApiTester } from './pages/ApiTester'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans text-gray-900 antialiased">
      <Sidebar current={page} onNavigate={setPage} />
      <main className="flex-1 overflow-y-auto">
        {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
        {page === 'book' && <BookAppointment />}
        {page === 'appointments' && <Appointments />}
        {page === 'availability' && <DoctorAvailability />}
        {page === 'api-tester' && <ApiTester />}
      </main>
    </div>
  )
}
