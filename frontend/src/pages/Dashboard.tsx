import { useState } from 'react'
import { Activity, Users, Stethoscope, CalendarCheck, Trash2 } from 'lucide-react'
import { getDoctors, deleteDoctor } from '../api/doctors'
import { getPatients, deletePatient } from '../api/patients'
import { useApi } from '../hooks/useApi'
import { ErrorAlert } from '../components/ui/ErrorAlert'
import { Spinner } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import { extractErrorMessage } from '../api/types'
import type { Doctor, Patient } from '../api/types'
import type { Page } from '../components/layout/Sidebar'

interface DashboardProps {
  onNavigate: (page: Page) => void
}

type DeleteTarget =
  | { kind: 'doctor'; item: Doctor }
  | { kind: 'patient'; item: Patient }

export function Dashboard({ onNavigate }: DashboardProps) {
  const doctors = useApi(getDoctors)
  const patients = useApi(getPatients)

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const loading = doctors.loading || patients.loading
  const error = doctors.error ?? patients.error

  const openDelete = (target: DeleteTarget) => {
    setDeleteTarget(target)
    setDeleteError(null)
  }
  const closeDelete = () => {
    setDeleteTarget(null)
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      if (deleteTarget.kind === 'doctor') {
        await deleteDoctor(deleteTarget.item.id)
        doctors.reload()
      } else {
        await deletePatient(deleteTarget.item.id)
        patients.reload()
      }
      closeDelete()
    } catch (err) {
      setDeleteError(extractErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
        <span className="mt-0.5 text-lg">🛠️</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">Admin / Developer Tool</p>
          <p className="text-xs text-amber-700 mt-0.5">
            This interface is for testing and administration only — not intended for patients.
            Use the <span className="font-medium">API Tester</span> to send raw requests, or manage records below.
          </p>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Overview of registered doctors and patients.</p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner /> Loading…
        </div>
      )}

      {error && <ErrorAlert message={error} />}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              icon={<Stethoscope className="h-5 w-5 text-teal-600" />}
              label="Active Doctors"
              value={doctors.data?.length ?? 0}
              bg="bg-teal-50"
            />
            <StatCard
              icon={<Users className="h-5 w-5 text-blue-600" />}
              label="Registered Patients"
              value={patients.data?.length ?? 0}
              bg="bg-blue-50"
            />
            <StatCard
              icon={<Activity className="h-5 w-5 text-violet-600" />}
              label="Specialties"
              value={new Set(doctors.data?.map((d) => d.specialty) ?? []).size}
              bg="bg-violet-50"
            />
            <StatCard
              icon={<CalendarCheck className="h-5 w-5 text-green-600" />}
              label="Book Appointment"
              value="→"
              bg="bg-green-50"
              onClick={() => onNavigate('book')}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title="Doctors">
              {doctors.data?.length === 0 ? (
                <EmptyState message="No doctors registered yet." />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {doctors.data?.map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{d.name}</p>
                        <p className="text-xs text-gray-500">
                          {d.specialty}
                          {d.email && <span className="ml-1">· {d.email}</span>}
                          {d.phone && <span className="ml-1">· {d.phone}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700">
                          ID {d.id}
                        </span>
                        <button
                          onClick={() => openDelete({ kind: 'doctor', item: d })}
                          className="rounded-lg border border-red-200 p-1.5 text-red-500 hover:bg-red-50"
                          title="Delete doctor"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Patients">
              {patients.data?.length === 0 ? (
                <EmptyState message="No patients registered yet." />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {patients.data?.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.email ?? p.phone ?? ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                          ID {p.id}
                        </span>
                        <button
                          onClick={() => openDelete({ kind: 'patient', item: p })}
                          className="rounded-lg border border-red-200 p-1.5 text-red-500 hover:bg-red-50"
                          title="Delete patient"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}

      {deleteTarget && (
        <Modal title={`Delete ${deleteTarget.kind}`} onClose={closeDelete}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Delete <span className="font-medium">{deleteTarget.item.name}</span>? This is
              permanent and only allowed if they have no appointments.
            </p>
            {deleteError && <ErrorAlert message={deleteError} />}
            <div className="flex justify-end gap-2">
              <button
                onClick={closeDelete}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Spinner className="text-white" />}
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function StatCard({
  icon, label, value, bg, onClick,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  bg: string
  onClick?: () => void
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-4 ${onClick ? 'cursor-pointer hover:border-teal-300' : ''}`}
      onClick={onClick}
    >
      <div className={`mb-3 inline-flex rounded-lg p-2 ${bg}`}>{icon}</div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs text-gray-500">{label}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">{title}</h2>
      {children}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <p className="py-4 text-center text-sm text-gray-400">{message}</p>
}
