const NAIROBI = 'Africa/Nairobi'

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', {
    timeZone: NAIROBI,
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', {
    timeZone: NAIROBI,
    timeStyle: 'short',
  })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', {
    timeZone: NAIROBI,
    dateStyle: 'medium',
  })
}

/** Slot start_time already carries +03:00 — pass it through unchanged. */
export function slotToBookingTime(slotStartTime: string): string {
  return slotStartTime
}

export function todayNairobi(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: NAIROBI })
}
