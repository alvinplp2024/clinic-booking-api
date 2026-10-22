import { apiFetch } from './client'
import type { AvailabilityRead, Doctor, DoctorScheduleRead, WorkingPeriod } from './types'

export const getDoctors = (): Promise<Doctor[]> => apiFetch('/doctors')

export const deleteDoctor = (doctorId: number): Promise<void> =>
  apiFetch(`/doctors/${doctorId}`, { method: 'DELETE' })

export const getDoctorAvailability = (
  doctorId: number,
  date: string,
): Promise<AvailabilityRead> =>
  apiFetch(`/doctors/${doctorId}/availability?date=${date}`)

export const getDoctorSchedule = (doctorId: number): Promise<DoctorScheduleRead> =>
  apiFetch(`/doctors/${doctorId}/schedule`)

export const putWeekdaySchedule = (
  doctorId: number,
  weekday: number,
  periods: WorkingPeriod[],
): Promise<DoctorScheduleRead> =>
  apiFetch(`/doctors/${doctorId}/schedule/${weekday}`, {
    method: 'PUT',
    body: JSON.stringify({ periods }),
  })
