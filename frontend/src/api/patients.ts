import { apiFetch } from './client'
import type { Patient, PatientAppointmentsRead } from './types'

export const getPatients = (): Promise<Patient[]> => apiFetch('/patients')

export const deletePatient = (patientId: number): Promise<void> =>
  apiFetch(`/patients/${patientId}`, { method: 'DELETE' })

export const getPatientAppointments = (
  patientId: number,
): Promise<PatientAppointmentsRead> =>
  apiFetch(`/patients/${patientId}/appointments`)
