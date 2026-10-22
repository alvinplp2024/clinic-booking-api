import { Calendar, CalendarCheck, FlaskConical, LayoutDashboard, Stethoscope } from 'lucide-react'

type Page = 'dashboard' | 'book' | 'appointments' | 'availability' | 'api-tester'

interface SidebarProps {
  current: Page
  onNavigate: (page: Page) => void
}

const nav: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'book', label: 'Book Appointment', icon: <CalendarCheck className="h-4 w-4" /> },
  { id: 'appointments', label: 'Appointments', icon: <Calendar className="h-4 w-4" /> },
  { id: 'availability', label: 'Doctor Availability', icon: <Stethoscope className="h-4 w-4" /> },
  { id: 'api-tester', label: 'API Tester', icon: <FlaskConical className="h-4 w-4" /> },
]

export function Sidebar({ current, onNavigate }: SidebarProps) {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4">
        <CalendarCheck className="h-5 w-5 text-teal-600" />
        <span className="text-sm font-semibold text-gray-900">Clinic Booking</span>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {nav.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              current === id
                ? 'bg-teal-50 font-medium text-teal-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>
      <div className="border-t border-gray-200 px-5 py-3">
        <p className="text-xs text-gray-400">Savannah Informatics</p>
      </div>
    </aside>
  )
}

export type { Page }
