export interface Doctor {
  id: number
  name: string
  specialty: string
  email: string | null
  phone: string | null
  is_active: boolean
}

export interface Patient {
  id: number
  name: string
  email: string | null
  phone: string | null
  is_active: boolean
}

export interface AvailableSlot {
  start_time: string
  end_time: string
}

export interface AvailabilityRead {
  doctor_id: number
  date: string
  timezone: string
  slots: AvailableSlot[]
}

export type AppointmentStatus = 'booked' | 'cancelled'

export interface Appointment {
  id: number
  doctor_id: number
  patient_id: number
  start_time: string
  end_time: string
  status: AppointmentStatus
  cancellation_reason: string | null
  cancelled_at: string | null
  created_at: string
}

export interface WorkingPeriod {
  start_time: string // "HH:MM:SS"
  end_time: string
}

export interface WorkingPeriodRead extends WorkingPeriod {
  id: number
  weekday: number
}

export interface DoctorScheduleRead {
  doctor_id: number
  schedule: WorkingPeriodRead[] // flat list, grouped in the frontend by weekday
}

export interface PatientAppointmentsRead {
  patient_id: number
  appointments: Appointment[]
}

export interface ApiBusinessError {
  error: { code: string; message: string }
}

export interface ApiValidationError {
  detail: { loc: (string | number)[]; msg: string; type: string }[]
}

export function isBusinessError(e: unknown): e is ApiBusinessError {
  return typeof e === 'object' && e !== null && 'error' in e
}

export function isValidationError(e: unknown): e is ApiValidationError {
  return typeof e === 'object' && e !== null && 'detail' in e
}

export function extractErrorMessage(e: unknown): string {
  if (isBusinessError(e)) return (e as ApiBusinessError).error.message
  if (isValidationError(e))
    return (e as ApiValidationError).detail.map((d) => d.msg).join('; ')
  if (e instanceof Error) return e.message
  return 'An unexpected error occurred.'
}
