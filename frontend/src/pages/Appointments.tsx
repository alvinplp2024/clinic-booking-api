import { useState } from 'react'
import { Clock, XCircle, RefreshCw, Eye } from 'lucide-react'
import { getPatients } from '../api/patients'
import { getPatientAppointments } from '../api/patients'
import { cancelAppointment, rescheduleAppointment, updateAppointmentStatus } from '../api/appointments'
import { getDoctors, getDoctorAvailability } from '../api/doctors'
import { useApi } from '../hooks/useApi'
import { extractErrorMessage } from '../api/types'
import type { Appointment, AvailableSlot } from '../api/types'
import { ErrorAlert } from '../components/ui/ErrorAlert'
import { Spinner } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { formatDateTime, formatTime, slotToBookingTime, todayNairobi } from '../utils/datetime'

export function Appointments() {
  const patients = useApi(getPatients)
  const doctors = useApi(getDoctors)
  const [patientId, setPatientId] = useState('')
  const [apptData, setApptData] = useState<Appointment[] | null>(null)
  const [apptLoading, setApptLoading] = useState(false)
  const [apptError, setApptError] = useState<string | null>(null)

  // View modal
  const [viewTarget, setViewTarget] = useState<Appointment | null>(null)

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  // Status update (complete / postpone)
  const [statusUpdating, setStatusUpdating] = useState<number | null>(null)

  const handleStatusUpdate = async (appt: Appointment, status: 'completed' | 'postponed') => {
    setStatusUpdating(appt.id)
    try {
      await updateAppointmentStatus(appt.id, status)
      void loadAppointments(patientId)
    } catch {
      // silently ignore — user can retry
    } finally {
      setStatusUpdating(null)
    }
  }

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState(todayNairobi())
  const [rescheduleSlots, setRescheduleSlots] = useState<AvailableSlot[] | null>(null)
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false)
  const [rescheduleSlotsError, setRescheduleSlotsError] = useState<string | null>(null)
  const [rescheduleSlot, setRescheduleSlot] = useState<AvailableSlot | null>(null)
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)

  const loadAppointments = async (pid: string) => {
    if (!pid) return
    setApptLoading(true)
    setApptError(null)
    try {
      const result = await getPatientAppointments(Number(pid))
      setApptData(result.appointments)
    } catch (err) {
      setApptError(extractErrorMessage(err))
    } finally {
      setApptLoading(false)
    }
  }

  const handlePatientChange = (pid: string) => {
    setPatientId(pid)
    setApptData(null)
    if (pid) void loadAppointments(pid)
  }

  // Cancel
  const openCancel = (appt: Appointment) => { setCancelTarget(appt); setCancelReason(''); setCancelError(null) }
  const closeCancel = () => { setCancelTarget(null); setCancelError(null) }
  const submitCancel = async () => {
    if (!cancelTarget || cancelReason.trim().length < 3) return
    setCancelSubmitting(true)
    setCancelError(null)
    try {
      await cancelAppointment(cancelTarget.id, cancelReason.trim())
      closeCancel()
      void loadAppointments(patientId)
    } catch (err) {
      setCancelError(extractErrorMessage(err))
    } finally {
      setCancelSubmitting(false)
    }
  }

  // Reschedule
  const openReschedule = (appt: Appointment) => {
    setRescheduleTarget(appt)
    setRescheduleDate(todayNairobi())
    setRescheduleSlots(null)
    setRescheduleSlot(null)
    setRescheduleSlotsError(null)
    setRescheduleError(null)
  }
  const closeReschedule = () => { setRescheduleTarget(null); setRescheduleError(null) }

  const fetchRescheduleSlots = async () => {
    if (!rescheduleTarget || !rescheduleDate) return
    setRescheduleSlotsLoading(true)
    setRescheduleSlotsError(null)
    setRescheduleSlots(null)
    setRescheduleSlot(null)
    try {
      const result = await getDoctorAvailability(rescheduleTarget.doctor_id, rescheduleDate)
      setRescheduleSlots(result.slots)
    } catch (err) {
      setRescheduleSlotsError(extractErrorMessage(err))
    } finally {
      setRescheduleSlotsLoading(false)
    }
  }

  const submitReschedule = async () => {
    if (!rescheduleTarget || !rescheduleSlot) return
    setRescheduleSubmitting(true)
    setRescheduleError(null)
    try {
      await rescheduleAppointment(rescheduleTarget.id, slotToBookingTime(rescheduleSlot.start_time))
      closeReschedule()
      void loadAppointments(patientId)
    } catch (err) {
      setRescheduleError(extractErrorMessage(err))
    } finally {
      setRescheduleSubmitting(false)
    }
  }

  const now = new Date()
  const upcoming = (apptData ?? []).filter((a) => a.status === 'booked' && new Date(a.start_time) >= now)
  const overdue = (apptData ?? []).filter((a) => a.status === 'booked' && new Date(a.start_time) < now).reverse()
  const completed = (apptData ?? []).filter((a) => a.status === 'completed').reverse()
  const postponed = (apptData ?? []).filter((a) => a.status === 'postponed').reverse()
  const cancelled = (apptData ?? []).filter((a) => a.status === 'cancelled').reverse()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Appointments</h1>
        <p className="mt-1 text-sm text-gray-500">View, cancel, or reschedule appointments.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="max-w-xs">
          <label className="mb-1 block text-xs font-medium text-gray-600">Select patient</label>
          {patients.loading ? (
            <Spinner />
          ) : patients.error ? (
            <ErrorAlert message={patients.error} />
          ) : (
            <SearchableSelect
              value={patientId}
              onChange={handlePatientChange}
              placeholder="— Select patient —"
              options={(patients.data ?? []).map((p) => ({ value: String(p.id), label: p.name, sub: p.email ?? p.phone ?? undefined }))}
            />
          )}
        </div>

        {apptLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Spinner /> Loading appointments…
          </div>
        )}
        {apptError && <ErrorAlert message={apptError} />}

        {apptData !== null && !apptLoading && apptData.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">No appointments found for this patient.</p>
        )}

        {apptData !== null && !apptLoading && apptData.length > 0 && (
          <div className="space-y-6">
            {/* Upcoming */}
            <Section
              title="Upcoming"
              count={upcoming.length}
              emptyText="No upcoming appointments."
              accent="teal"
            >
              {upcoming.map((appt) => (
                <AppointmentRow
                  key={appt.id}
                  appt={appt}
                  onView={() => setViewTarget(appt)}
                  onCancel={() => openCancel(appt)}
                  onReschedule={() => openReschedule(appt)}
                />
              ))}
            </Section>

            {/* Overdue booked */}
            {overdue.length > 0 && (
              <Section title="Overdue" count={overdue.length} accent="gray">
                {overdue.map((appt) => (
                  <AppointmentRow
                    key={appt.id}
                    appt={appt}
                    onView={() => setViewTarget(appt)}
                    onReschedule={() => openReschedule(appt)}
                    onCancel={() => openCancel(appt)}
                    onComplete={() => void handleStatusUpdate(appt, 'completed')}
                    onPostpone={() => void handleStatusUpdate(appt, 'postponed')}
                    statusUpdating={statusUpdating === appt.id}
                  />
                ))}
              </Section>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <Section title="Completed" count={completed.length} accent="teal">
                {completed.map((appt) => (
                  <AppointmentRow
                    key={appt.id}
                    appt={appt}
                    dim
                    onView={() => setViewTarget(appt)}
                  />
                ))}
              </Section>
            )}

            {/* Postponed */}
            {postponed.length > 0 && (
              <Section title="Postponed" count={postponed.length} accent="gray">
                {postponed.map((appt) => (
                  <AppointmentRow
                    key={appt.id}
                    appt={appt}
                    dim
                    onView={() => setViewTarget(appt)}
                  />
                ))}
              </Section>
            )}

            {/* Cancelled */}
            {cancelled.length > 0 && (
              <Section title="Cancelled" count={cancelled.length} accent="red">
                {cancelled.map((appt) => (
                  <AppointmentRow
                    key={appt.id}
                    appt={appt}
                    dim
                    onView={() => setViewTarget(appt)}
                  />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>

      {/* View details modal */}
      {viewTarget && (() => {
        const doc = doctors.data?.find((d) => d.id === viewTarget.doctor_id)
        const pat = patients.data?.find((p) => p.id === viewTarget.patient_id)
        return (
          <Modal title={`Appointment #${viewTarget.id}`} onClose={() => setViewTarget(null)}>
            <div className="space-y-3 text-sm">
              <Row label="Status">
                <Badge
                  label={viewTarget.status}
                  variant={
                    viewTarget.status === 'booked' ? 'teal'
                    : viewTarget.status === 'completed' ? 'green'
                    : viewTarget.status === 'postponed' ? 'amber'
                    : 'red'
                  }
                />
              </Row>
              <Row label="Start">{formatDateTime(viewTarget.start_time)}</Row>
              <Row label="End">{formatDateTime(viewTarget.end_time)}</Row>
              <Row label="Doctor">
                <span>{doc ? `${doc.name}` : `ID ${viewTarget.doctor_id}`}</span>
                {doc && <span className="ml-1 text-gray-400">· {doc.specialty}</span>}
              </Row>
              <Row label="Patient">
                <span>{pat ? pat.name : `ID ${viewTarget.patient_id}`}</span>
                {pat?.email && <span className="ml-1 text-gray-400">· {pat.email}</span>}
                {pat?.phone && !pat.email && <span className="ml-1 text-gray-400">· {pat.phone}</span>}
              </Row>
              <Row label="Booked at">{formatDateTime(viewTarget.created_at)}</Row>
              {viewTarget.cancelled_at && (
                <Row label="Cancelled at">{formatDateTime(viewTarget.cancelled_at)}</Row>
              )}
              {viewTarget.cancellation_reason && (
                <Row label="Cancel reason">
                  <span className="text-red-600">{viewTarget.cancellation_reason}</span>
                </Row>
              )}
            </div>
          </Modal>
        )
      })()}

      {/* Cancel modal */}
      {cancelTarget && (
        <Modal title="Cancel appointment" onClose={closeCancel}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Cancelling appointment <span className="font-medium">#{cancelTarget.id}</span> on{' '}
              <span className="font-medium">{formatDateTime(cancelTarget.start_time)}</span>.
              This action cannot be undone.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Reason <span className="text-gray-400">(required, min 3 characters)</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="e.g. Patient requested cancellation"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>
            {cancelError && <ErrorAlert message={cancelError} />}
            <div className="flex justify-end gap-2">
              <button onClick={closeCancel} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Keep appointment
              </button>
              <button
                onClick={() => void submitCancel()}
                disabled={cancelReason.trim().length < 3 || cancelSubmitting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelSubmitting && <Spinner className="text-white" />}
                Cancel appointment
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reschedule modal */}
      {rescheduleTarget && (
        <Modal title="Reschedule appointment" onClose={closeReschedule}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Rescheduling appointment <span className="font-medium">#{rescheduleTarget.id}</span>.
              Choose a new date and slot.
            </p>
            <div className="flex gap-2">
              <input
                type="date"
                value={rescheduleDate}
                min={todayNairobi()}
                onChange={(e) => { setRescheduleDate(e.target.value); setRescheduleSlots(null); setRescheduleSlot(null) }}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              />
              <button
                onClick={() => void fetchRescheduleSlots()}
                disabled={rescheduleSlotsLoading}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {rescheduleSlotsLoading ? <Spinner className="text-white" /> : 'Check slots'}
              </button>
            </div>
            {rescheduleSlotsError && <ErrorAlert message={rescheduleSlotsError} />}
            {rescheduleSlots !== null && (
              rescheduleSlots.length === 0 ? (
                <p className="text-sm text-gray-400">No available slots on this date.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {rescheduleSlots.map((slot) => (
                    <button
                      key={slot.start_time}
                      onClick={() => setRescheduleSlot(slot)}
                      className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm ${
                        rescheduleSlot?.start_time === slot.start_time
                          ? 'border-teal-500 bg-teal-50 font-medium text-teal-700'
                          : 'border-gray-200 text-gray-700 hover:border-teal-300'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime(slot.start_time)}
                    </button>
                  ))}
                </div>
              )
            )}
            {rescheduleError && <ErrorAlert message={rescheduleError} />}
            <div className="flex justify-end gap-2">
              <button onClick={closeReschedule} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => void submitReschedule()}
                disabled={!rescheduleSlot || rescheduleSubmitting}
                className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {rescheduleSubmitting && <Spinner className="text-white" />}
                Confirm reschedule
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const accentStyles = {
  teal: { bar: 'bg-teal-500', text: 'text-teal-700', badge: 'bg-teal-50 text-teal-600' },
  gray: { bar: 'bg-gray-300', text: 'text-gray-500', badge: 'bg-gray-100 text-gray-500' },
  red:  { bar: 'bg-red-400',  text: 'text-red-600',  badge: 'bg-red-50 text-red-500'   },
}

function Section({
  title, count, accent, emptyText, children,
}: {
  title: string
  count: number
  accent: 'teal' | 'gray' | 'red'
  emptyText?: string
  children?: React.ReactNode
}) {
  const s = accentStyles[accent]
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100`}>
        <span className={`h-3.5 w-1 rounded-full ${s.bar}`} />
        <span className={`text-sm font-semibold ${s.text}`}>{title}</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}>{count}</span>
      </div>
      {count === 0 && emptyText ? (
        <p className="px-4 py-5 text-sm text-gray-400">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-gray-100 bg-white">{children}</ul>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-xs font-medium text-gray-500 w-28">{label}</span>
      <span className="text-right text-gray-800">{children}</span>
    </div>
  )
}

function AppointmentRow({
  appt,
  onView,
  onCancel,
  onReschedule,
  onComplete,
  onPostpone,
  statusUpdating,
  dim,
}: {
  appt: Appointment
  onView: () => void
  onCancel?: () => void
  onReschedule?: () => void
  onComplete?: () => void
  onPostpone?: () => void
  statusUpdating?: boolean
  dim?: boolean
}) {
  const isCancelled = appt.status === 'cancelled'
  const isCompleted = appt.status === 'completed'
  const isPostponed = appt.status === 'postponed'
  const isOverdue = appt.status === 'booked' && new Date(appt.start_time) < new Date()
  const badgeVariant = isCancelled ? 'red' : isCompleted ? 'green' : isPostponed ? 'amber' : isOverdue ? 'gray' : 'teal'
  const badgeLabel = appt.status === 'booked' ? (isOverdue ? 'overdue' : 'upcoming') : appt.status
  const isTerminal = isCancelled || isCompleted || isPostponed
  return (
    <li className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
      dim ? 'opacity-55' : ''
    }`}>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${dim ? 'text-gray-500' : 'text-gray-900'}`}>
            {formatDateTime(appt.start_time)}
          </span>
          <Badge label={badgeLabel} variant={badgeVariant} />
        </div>
        <p className="text-xs text-gray-400">
          Appt #{appt.id} · Doctor ID {appt.doctor_id}
        </p>
        {appt.cancellation_reason && (
          <p className="text-xs text-red-400">Reason: {appt.cancellation_reason}</p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onView}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>
        {!isTerminal && onReschedule && (
          <button
            onClick={onReschedule}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reschedule
          </button>
        )}
        {!isTerminal && onComplete && (
          <button
            onClick={onComplete}
            disabled={statusUpdating}
            className="flex items-center gap-1.5 rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
          >
            Complete
          </button>
        )}
        {!isTerminal && onPostpone && (
          <button
            onClick={onPostpone}
            disabled={statusUpdating}
            className="flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            Postpone
          </button>
        )}
        {!isTerminal && onCancel && (
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancel
          </button>
        )}
      </div>
    </li>
  )
}
