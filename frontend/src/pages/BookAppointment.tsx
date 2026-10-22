import { useState } from 'react'
import { CheckCircle, Clock } from 'lucide-react'
import { getDoctors, getDoctorAvailability } from '../api/doctors'
import { getPatients } from '../api/patients'
import { bookAppointment } from '../api/appointments'
import { useApi } from '../hooks/useApi'
import { extractErrorMessage } from '../api/types'
import type { AvailableSlot } from '../api/types'
import { ErrorAlert } from '../components/ui/ErrorAlert'
import { Spinner } from '../components/ui/Spinner'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { formatTime, slotToBookingTime, todayNairobi } from '../utils/datetime'

export function BookAppointment() {
  const doctors = useApi(getDoctors)
  const patients = useApi(getPatients)

  const [doctorId, setDoctorId] = useState('')
  const [patientId, setPatientId] = useState('')
  const [date, setDate] = useState(todayNairobi())
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const fetchSlots = async () => {
    if (!doctorId || !date) return
    setSlotsLoading(true)
    setSlotsError(null)
    setSlots(null)
    setSelectedSlot(null)
    try {
      const result = await getDoctorAvailability(Number(doctorId), date)
      setSlots(result.slots)
    } catch (err) {
      setSlotsError(extractErrorMessage(err))
    } finally {
      setSlotsLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedSlot || !doctorId || !patientId) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await bookAppointment({
        doctor_id: Number(doctorId),
        patient_id: Number(patientId),
        start_time: slotToBookingTime(selectedSlot.start_time),
      })
      setSuccess(true)
      setSlots(null)
      setSelectedSlot(null)
    } catch (err) {
      setSubmitError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <CheckCircle className="h-12 w-12 text-teal-500" />
        <p className="text-lg font-semibold text-gray-900">Appointment booked successfully</p>
        <button
          onClick={() => setSuccess(false)}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Book another
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Book Appointment</h1>
        <p className="mt-1 text-sm text-gray-500">
          Select a doctor and date to see available slots, then choose a patient and confirm.
        </p>
      </div>

      {(doctors.error ?? patients.error) && (
        <ErrorAlert message={doctors.error ?? patients.error ?? ''} />
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
        {/* Step 1 — Doctor + Date */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-700">1. Select doctor and date</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Doctor</label>
              {doctors.loading ? (
                <Spinner />
              ) : (
                <SearchableSelect
                  value={doctorId}
                  onChange={(v) => { setDoctorId(v); setSlots(null); setSelectedSlot(null) }}
                  placeholder="— Select doctor —"
                  options={(doctors.data ?? []).map((d) => ({ value: String(d.id), label: d.name, sub: d.specialty }))}
                />
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Date</label>
              <input
                type="date"
                value={date}
                min={todayNairobi()}
                onChange={(e) => { setDate(e.target.value); setSlots(null); setSelectedSlot(null) }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>
          <button
            onClick={fetchSlots}
            disabled={!doctorId || !date || slotsLoading}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {slotsLoading && <Spinner className="text-white" />}
            Check availability
          </button>
          {slotsError && <ErrorAlert message={slotsError} />}
        </fieldset>

        {/* Step 2 — Slot selection */}
        {slots !== null && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-700">2. Choose a slot</legend>
            {slots.length === 0 ? (
              <p className="text-sm text-gray-400">No available slots for this doctor on this date.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.start_time}
                    onClick={() => setSelectedSlot(slot)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      selectedSlot?.start_time === slot.start_time
                        ? 'border-teal-500 bg-teal-50 font-medium text-teal-700'
                        : 'border-gray-200 text-gray-700 hover:border-teal-300'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                  </button>
                ))}
              </div>
            )}
          </fieldset>
        )}

        {/* Step 3 — Patient + confirm */}
        {selectedSlot && (
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-700">3. Select patient and confirm</legend>
            <div className="max-w-xs">
              <label className="mb-1 block text-xs font-medium text-gray-600">Patient</label>
              {patients.loading ? (
                <Spinner />
              ) : (
                <SearchableSelect
                  value={patientId}
                  onChange={setPatientId}
                  placeholder="— Select patient —"
                  options={(patients.data ?? []).map((p) => ({ value: String(p.id), label: p.name, sub: p.email ?? p.phone ?? undefined }))}
                />
              )}
            </div>
            {submitError && <ErrorAlert message={submitError} />}
            <button
              onClick={handleSubmit}
              disabled={!patientId || submitting}
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {submitting && <Spinner className="text-white" />}
              Confirm booking
            </button>
          </fieldset>
        )}
      </div>
    </div>
  )
}
