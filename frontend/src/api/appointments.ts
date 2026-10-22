import { apiFetch } from './client'
import type { Appointment } from './types'

export const bookAppointment = (payload: {
  doctor_id: number
  patient_id: number
  start_time: string
}): Promise<Appointment> =>
  apiFetch('/appointments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const cancelAppointment = (
  appointmentId: number,
  reason: string,
): Promise<Appointment> =>
  apiFetch(`/appointments/${appointmentId}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  })

export const rescheduleAppointment = (
  appointmentId: number,
  start_time: string,
): Promise<Appointment> =>
  apiFetch(`/appointments/${appointmentId}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify({ start_time }),
  })
