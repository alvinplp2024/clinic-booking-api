import { useState, useEffect, useCallback } from 'react'
import { Clock, Plus, Trash2, CalendarDays, Save, RefreshCw, CheckCircle2 } from 'lucide-react'
import { getDoctors, getDoctorAvailability, getDoctorSchedule, putWeekdaySchedule } from '../api/doctors'
import { useApi } from '../hooks/useApi'
import { extractErrorMessage } from '../api/types'
import type { AvailableSlot, WorkingPeriod, WorkingPeriodRead, DoctorScheduleRead } from '../api/types'
import { ErrorAlert } from '../components/ui/ErrorAlert'
import { Spinner } from '../components/ui/Spinner'
import { formatTime, todayNairobi } from '../utils/datetime'

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface EditPeriod { start: string; end: string }

function toEditPeriod(p: WorkingPeriod): EditPeriod {
  return { start: p.start_time.slice(0, 5), end: p.end_time.slice(0, 5) }
}
function toApiPeriod(p: EditPeriod): WorkingPeriod {
  return { start_time: `${p.start}:00`, end_time: `${p.end}:00` }
}

interface DayState {
  periods: EditPeriod[]
  dirty: boolean
  saving: boolean
  saved: boolean
  error: string | null
}

function initDays(schedule: WorkingPeriodRead[]): DayState[] {
  return WEEKDAY_NAMES.map((_, idx) => ({
    periods: schedule.filter((p) => p.weekday === idx).map(toEditPeriod),
    dirty: false,
    saving: false,
    saved: false,
    error: null,
  }))
}

// ── Slot grid ────────────────────────────────────────────────────────────────

function SlotGroup({ label, items }: { label: string; items: AvailableSlot[] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((slot) => (
          <div
            key={slot.start_time}
            className="flex items-center gap-1.5 rounded-lg border border-teal-100 bg-teal-50 px-3 py-1.5"
          >
            <Clock className="h-3 w-3 text-teal-400" />
            <span className="text-xs font-medium text-teal-700">{formatTime(slot.start_time)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SlotGrid({ slots, timezone }: { slots: AvailableSlot[]; timezone: string | null }) {
  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <CalendarDays className="mb-3 h-8 w-8 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">No slots available</p>
        <p className="mt-1 text-xs text-gray-400">
          Check the schedule editor — this day may have no working hours set.
        </p>
      </div>
    )
  }

  const am = slots.filter((s) => new Date(s.start_time).getHours() < 12)
  const pm = slots.filter((s) => new Date(s.start_time).getHours() >= 12)

  return (
    <div className="space-y-4">
      <SlotGroup label="Morning" items={am} />
      <SlotGroup label="Afternoon" items={pm} />
      <p className="text-xs text-gray-400">
        {slots.length} slot{slots.length !== 1 ? 's' : ''} · 30 min each
        {timezone && <span className="ml-1">· {timezone}</span>}
      </p>
    </div>
  )
}

// ── Schedule editor ──────────────────────────────────────────────────────────

interface ScheduleEditorProps {
  days: DayState[]
  onAdd: (idx: number) => void
  onRemove: (idx: number, i: number) => void
  onChange: (idx: number, i: number, field: 'start' | 'end', v: string) => void
  onSave: (idx: number) => void
  onSaveAll: () => void
  anyDirty: boolean
}

function ScheduleEditor({ days, onAdd, onRemove, onChange, onSave, onSaveAll, anyDirty }: ScheduleEditorProps) {
  return (
    <div className="space-y-1">
      {WEEKDAY_NAMES.map((name, idx) => {
        const day = days[idx]
        const isWeekend = idx >= 5
        return (
          <div
            key={idx}
            className={`rounded-xl border px-4 py-3 transition-colors ${
              day.dirty
                ? 'border-amber-200 bg-amber-50'
                : day.saved
                ? 'border-green-200 bg-green-50'
                : 'border-gray-100 bg-gray-50'
            }`}
          >
            {/* Day header */}
            <div className="flex items-center gap-3">
              <div className="w-20 shrink-0">
                <span className={`text-sm font-semibold ${isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>
                  {WEEKDAY_SHORT[idx]}
                </span>
                <span className="ml-1 hidden text-xs text-gray-400 sm:inline">
                  {name.slice(3)}
                </span>
              </div>

              {/* Periods inline */}
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {day.periods.length === 0 ? (
                  <span className="text-xs text-gray-400 italic">Off</span>
                ) : (
                  day.periods.map((p, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <input
                        type="time"
                        value={p.start}
                        onChange={(e) => onChange(idx, i, 'start', e.target.value)}
                        disabled={day.saving}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-mono focus:border-teal-400 focus:outline-none disabled:opacity-50"
                      />
                      <span className="text-xs text-gray-300">–</span>
                      <input
                        type="time"
                        value={p.end}
                        onChange={(e) => onChange(idx, i, 'end', e.target.value)}
                        disabled={day.saving}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-mono focus:border-teal-400 focus:outline-none disabled:opacity-50"
                      />
                      <button
                        onClick={() => onRemove(idx, i)}
                        disabled={day.saving}
                        className="rounded p-0.5 text-gray-300 hover:text-red-400 disabled:opacity-50"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
                <button
                  onClick={() => onAdd(idx)}
                  disabled={day.saving}
                  className="flex items-center gap-0.5 rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-400 hover:border-teal-400 hover:text-teal-600 disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>

              {/* Per-day save */}
              <div className="flex shrink-0 items-center gap-2">
                {day.saved && !day.dirty && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                {day.dirty && (
                  <button
                    onClick={() => onSave(idx)}
                    disabled={day.saving}
                    className="flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    {day.saving ? <Spinner className="h-3 w-3 text-white" /> : <Save className="h-3 w-3" />}
                    Save
                  </button>
                )}
              </div>
            </div>

            {day.error && (
              <p className="mt-2 text-xs text-red-500">{day.error}</p>
            )}
          </div>
        )
      })}

      {/* Save all */}
      {anyDirty && (
        <div className="pt-2">
          <button
            onClick={onSaveAll}
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            <Save className="h-4 w-4" />
            Save all changes
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function DoctorAvailability() {
  const doctors = useApi(getDoctors)
  const [doctorId, setDoctorId] = useState('')
  const [date, setDate] = useState(todayNairobi())

  // Availability
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null)
  const [timezone, setTimezone] = useState<string | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)

  // Schedule
  const [days, setDays] = useState<DayState[] | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  const fetchSlots = useCallback(async (id: string, d: string) => {
    if (!id || !d) return
    setSlotsLoading(true)
    setSlotsError(null)
    try {
      const result = await getDoctorAvailability(Number(id), d)
      setSlots(result.slots)
      setTimezone(result.timezone)
    } catch (err) {
      setSlotsError(extractErrorMessage(err))
      setSlots(null)
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  const fetchSchedule = useCallback(async (id: string) => {
    if (!id) return
    setScheduleLoading(true)
    setScheduleError(null)
    setDays(null)
    try {
      const result: DoctorScheduleRead = await getDoctorSchedule(Number(id))
      setDays(initDays(result.schedule))
    } catch (err) {
      setScheduleError(extractErrorMessage(err))
    } finally {
      setScheduleLoading(false)
    }
  }, [])

  // Auto-fetch both when doctor or date changes
  useEffect(() => {
    if (doctorId) {
      void fetchSchedule(doctorId)
      void fetchSlots(doctorId, date)
    } else {
      setDays(null)
      setSlots(null)
    }
  }, [doctorId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (doctorId && date) void fetchSlots(doctorId, date)
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateDay = (idx: number, updater: (prev: DayState) => DayState) =>
    setDays((prev) => prev ? prev.map((d, i) => i === idx ? updater(d) : d) : prev)

  const handleAdd = (idx: number) =>
    updateDay(idx, (d) => ({ ...d, dirty: true, saved: false, periods: [...d.periods, { start: '09:00', end: '17:00' }] }))

  const handleRemove = (idx: number, i: number) =>
    updateDay(idx, (d) => ({ ...d, dirty: true, saved: false, periods: d.periods.filter((_, j) => j !== i) }))

  const handleChange = (idx: number, i: number, field: 'start' | 'end', v: string) =>
    updateDay(idx, (d) => ({
      ...d, dirty: true, saved: false,
      periods: d.periods.map((p, j) => j === i ? { ...p, [field]: v } : p),
    }))

  const saveDay = async (idx: number) => {
    if (!doctorId || !days) return
    const row = days[idx]
    updateDay(idx, (d) => ({ ...d, saving: true, error: null }))
    try {
      await putWeekdaySchedule(Number(doctorId), idx, row.periods.map(toApiPeriod))
      updateDay(idx, (d) => ({ ...d, saving: false, dirty: false, saved: true }))
      void fetchSlots(doctorId, date)
    } catch (err) {
      updateDay(idx, (d) => ({ ...d, saving: false, error: extractErrorMessage(err) }))
    }
  }

  const saveAll = () => {
    if (!days) return
    days.forEach((d, idx) => { if (d.dirty) void saveDay(idx) })
  }

  const anyDirty = days?.some((d) => d.dirty) ?? false
  const selectedDoctor = doctors.data?.find((d) => d.id === Number(doctorId))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Doctor Availability</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure a doctor's weekly schedule and check available slots by date.
        </p>
      </div>

      {/* Doctor selector */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        {doctors.loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner /> Loading doctors…</div>
        ) : doctors.error ? (
          <ErrorAlert message={doctors.error} />
        ) : doctors.data?.length === 0 ? (
          <p className="text-sm text-gray-400">No doctors registered yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {doctors.data?.map((d) => (
              <button
                key={d.id}
                onClick={() => setDoctorId(String(d.id))}
                className={`rounded-xl border px-4 py-2.5 text-left transition-all ${
                  doctorId === String(d.id)
                    ? 'border-teal-500 bg-teal-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-teal-300'
                }`}
              >
                <p className={`text-sm font-semibold ${doctorId === String(d.id) ? 'text-teal-700' : 'text-gray-800'}`}>
                  {d.name}
                </p>
                <p className="text-xs text-gray-400">{d.specialty}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Two-column: schedule + availability */}
      {doctorId && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* ── Schedule editor ── */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Weekly Schedule</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedDoctor?.name} · unsaved changes are highlighted
                </p>
              </div>
              {scheduleLoading && <Spinner />}
            </div>

            {scheduleError && <ErrorAlert message={scheduleError} />}

            {days && (
              <ScheduleEditor
                days={days}
                onAdd={handleAdd}
                onRemove={handleRemove}
                onChange={handleChange}
                onSave={(idx) => void saveDay(idx)}
                onSaveAll={saveAll}
                anyDirty={anyDirty}
              />
            )}
          </div>

          {/* ── Availability checker ── */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Available Slots</h2>
                <p className="text-xs text-gray-400 mt-0.5">{selectedDoctor?.name}</p>
              </div>
              <button
                onClick={() => void fetchSlots(doctorId, date)}
                disabled={slotsLoading}
                className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:border-teal-400 hover:text-teal-600 disabled:opacity-50"
                title="Refresh slots"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${slotsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Date picker */}
            <input
              type="date"
              value={date}
              min={todayNairobi()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />

            {slotsError && <ErrorAlert message={slotsError} />}

            {slotsLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
                <Spinner /> Checking availability…
              </div>
            ) : slots !== null ? (
              <SlotGrid slots={slots} timezone={timezone} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
