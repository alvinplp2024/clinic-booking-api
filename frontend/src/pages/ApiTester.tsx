import { useState } from 'react'
import { Send, ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import { Spinner } from '../components/ui/Spinner'
import type { Doctor, Patient } from '../api/types'

// ── Endpoint definitions ────────────────────────────────────────────────────

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

interface ParamDef {
  name: string
  label: string
  placeholder: string
  lookup?: 'doctor' | 'patient'
  default?: string
  options?: { label: string; value: string }[]
}

interface EndpointDef {
  id: string
  method: Method
  pathTemplate: string
  label: string
  pathParams: ParamDef[]
  queryParams: ParamDef[]
  defaultBody: string
}

const ENDPOINTS: { group: string; items: EndpointDef[] }[] = [
  {
    group: 'System',
    items: [
      { id: 'health', method: 'GET', pathTemplate: '/health', label: 'Health check', pathParams: [], queryParams: [], defaultBody: '' },
    ],
  },
  {
    group: 'Doctors',
    items: [
      { id: 'list-doctors', method: 'GET', pathTemplate: '/doctors', label: 'List doctors', pathParams: [], queryParams: [], defaultBody: '' },
      {
        id: 'create-doctor', method: 'POST', pathTemplate: '/doctors', label: 'Register a doctor',
        pathParams: [], queryParams: [],
        defaultBody: JSON.stringify({ name: 'Dr Alvin Ondieki', specialty: 'General Practice', email: 'alvinondieki5@gmail.com', phone: '+254700921906' }, null, 2),
      },
      {
        id: 'delete-doctor', method: 'DELETE', pathTemplate: '/doctors/{doctor_id}', label: 'Delete a doctor',
        pathParams: [{ name: 'doctor_id', label: 'Doctor ID', placeholder: '1', lookup: 'doctor' }],
        queryParams: [], defaultBody: '',
      },
      {
        id: 'get-schedule', method: 'GET', pathTemplate: '/doctors/{doctor_id}/schedule', label: 'Get weekly schedule',
        pathParams: [{ name: 'doctor_id', label: 'Doctor ID', placeholder: '1', lookup: 'doctor' }],
        queryParams: [], defaultBody: '',
      },
      {
        id: 'put-schedule', method: 'PUT', pathTemplate: '/doctors/{doctor_id}/schedule/{weekday}', label: 'Set weekday schedule',
        pathParams: [
          { name: 'doctor_id', label: 'Doctor ID', placeholder: '1', lookup: 'doctor' },
          {
            name: 'weekday', label: 'Weekday', placeholder: '0', default: '0',
            options: [
              { label: 'Monday', value: '0' },
              { label: 'Tuesday', value: '1' },
              { label: 'Wednesday', value: '2' },
              { label: 'Thursday', value: '3' },
              { label: 'Friday', value: '4' },
              { label: 'Saturday', value: '5' },
              { label: 'Sunday', value: '6' },
            ],
          },
        ],
        queryParams: [],
        defaultBody: JSON.stringify({ periods: [{ start_time: '09:00:00', end_time: '17:00:00' }] }, null, 2),
      },
      {
        id: 'availability', method: 'GET', pathTemplate: '/doctors/{doctor_id}/availability', label: 'Get availability slots',
        pathParams: [{ name: 'doctor_id', label: 'Doctor ID', placeholder: '1', lookup: 'doctor' }],
        queryParams: [{ name: 'date', label: 'Date (YYYY-MM-DD)', placeholder: '2026-11-02' }],
        defaultBody: '',
      },
    ],
  },
  {
    group: 'Patients',
    items: [
      { id: 'list-patients', method: 'GET', pathTemplate: '/patients', label: 'List patients', pathParams: [], queryParams: [], defaultBody: '' },
      {
        id: 'create-patient', method: 'POST', pathTemplate: '/patients', label: 'Register a patient',
        pathParams: [], queryParams: [],
        defaultBody: JSON.stringify({ name: 'Alvin Ondieki', email: 'alvinondieki5@gmail.com', phone: '+254700921906' }, null, 2),
      },
      {
        id: 'delete-patient', method: 'DELETE', pathTemplate: '/patients/{patient_id}', label: 'Delete a patient',
        pathParams: [{ name: 'patient_id', label: 'Patient ID', placeholder: '1', lookup: 'patient' }],
        queryParams: [], defaultBody: '',
      },
      {
        id: 'patient-appointments', method: 'GET', pathTemplate: '/patients/{patient_id}/appointments', label: 'List patient appointments',
        pathParams: [{ name: 'patient_id', label: 'Patient ID', placeholder: '1', lookup: 'patient' }],
        queryParams: [], defaultBody: '',
      },
    ],
  },
  {
    group: 'Appointments',
    items: [
      {
        id: 'book', method: 'POST', pathTemplate: '/appointments', label: 'Book an appointment',
        pathParams: [], queryParams: [],
        defaultBody: JSON.stringify({ doctor_id: 1, patient_id: 1, start_time: '2026-11-02T10:00:00+03:00' }, null, 2),
      },
      {
        id: 'cancel', method: 'PATCH', pathTemplate: '/appointments/{appointment_id}/cancel', label: 'Cancel an appointment',
        pathParams: [{ name: 'appointment_id', label: 'Appointment ID', placeholder: '1' }],
        queryParams: [],
        defaultBody: JSON.stringify({ reason: 'Patient requested cancellation' }, null, 2),
      },
      {
        id: 'reschedule', method: 'PATCH', pathTemplate: '/appointments/{appointment_id}/reschedule', label: 'Reschedule an appointment',
        pathParams: [{ name: 'appointment_id', label: 'Appointment ID', placeholder: '1' }],
        queryParams: [],
        defaultBody: JSON.stringify({ start_time: '2026-11-02T11:00:00+03:00' }, null, 2),
      },
    ],
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8000'

const METHOD_COLORS: Record<Method, string> = {
  GET:    'bg-blue-100 text-blue-700',
  POST:   'bg-green-100 text-green-700',
  PATCH:  'bg-amber-100 text-amber-700',
  PUT:    'bg-violet-100 text-violet-700',
  DELETE: 'bg-red-100 text-red-700',
}

function buildUrl(template: string, path: Record<string, string>, query: Record<string, string>) {
  let url = template
  for (const [k, v] of Object.entries(path)) url = url.replace(`{${k}}`, encodeURIComponent(v))
  const qs = Object.entries(query)
    .filter(([, v]) => v.trim() !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  return qs ? `${url}?${qs}` : url
}

function nowMs(): number { return Date.now() }

// ── Lookup popover ────────────────────────────────────────────────────────────

interface LookupPopoverProps {
  kind: 'doctor' | 'patient'
  onSelect: (id: string) => void
  onClose: () => void
}

function LookupPopover({ kind, onSelect, onClose }: LookupPopoverProps) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<(Doctor | Patient)[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BASE_URL}/${kind}s`, {
        headers: { Accept: 'application/json' },
      })
      const data: unknown = await res.json()
      setItems(data as (Doctor | Patient)[])
    } catch {
      setError('Failed to fetch')
    } finally {
      setLoading(false)
    }
  }

  // Load once on mount
  useState(() => { void load() })

  const q = query.toLowerCase()
  const filtered = items?.filter((item) => {
    if (kind === 'doctor') {
      const d = item as Doctor
      return d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q) || (d.email ?? '').toLowerCase().includes(q) || (d.phone ?? '').toLowerCase().includes(q)
    }
    const p = item as Patient
    return p.name.toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q) || (p.phone ?? '').toLowerCase().includes(q)
  }) ?? []

  return (
    <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={kind === 'doctor' ? 'Search by name or specialty…' : 'Search by name or email…'}
          className="flex-1 text-xs outline-none placeholder:text-gray-400"
        />
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-48 overflow-y-auto">
        {loading && (
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-gray-500">
            <Spinner /> Loading…
          </div>
        )}
        {error && <p className="px-3 py-3 text-xs text-red-500">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="px-3 py-3 text-xs text-gray-400">No results.</p>
        )}
        {filtered.map((item) => {
          const isDoctor = kind === 'doctor'
          const d = item as Doctor
          const p = item as Patient
          return (
            <button
              key={item.id}
              onClick={() => { onSelect(String(item.id)); onClose() }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-teal-50"
            >
              <div>
                <span className="font-medium text-gray-800">{item.name}</span>
                <span className="ml-2 text-gray-400">
                  {isDoctor ? (d.email ?? d.phone ?? d.specialty) : (p.email ?? p.phone ?? '')}
                </span>
              </div>
              <span className="ml-3 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-500">
                ID {item.id}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface ResponseState { status: number; ms: number; body: unknown }

export function ApiTester() {
  const [selectedId, setSelectedId] = useState<string>('health')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [pathVals, setPathVals] = useState<Record<string, Record<string, string>>>({})
  const [queryVals, setQueryVals] = useState<Record<string, Record<string, string>>>({})
  const [bodyVals, setBodyVals] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [response, setResponse] = useState<ResponseState | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  // which param's lookup popover is open: "<endpointId>:<paramName>"
  const [openLookup, setOpenLookup] = useState<string | null>(null)

  const allEndpoints = ENDPOINTS.flatMap((g) => g.items)
  const endpoint = allEndpoints.find((e) => e.id === selectedId)!

  const pathVal = (name: string) => {
    const stored = pathVals[selectedId]?.[name]
    if (stored !== undefined) return stored
    return endpoint.pathParams.find((p) => p.name === name)?.default ?? ''
  }
  const queryVal = (name: string) => queryVals[selectedId]?.[name] ?? ''
  const bodyVal = bodyVals[selectedId] ?? endpoint.defaultBody

  const setPath = (name: string, value: string) =>
    setPathVals((prev) => ({ ...prev, [selectedId]: { ...prev[selectedId], [name]: value } }))
  const setQuery = (name: string, value: string) =>
    setQueryVals((prev) => ({ ...prev, [selectedId]: { ...prev[selectedId], [name]: value } }))
  const setBody = (value: string) =>
    setBodyVals((prev) => ({ ...prev, [selectedId]: value }))

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setResponse(null)
    setFetchError(null)
    setOpenLookup(null)
  }

  const handleSend = async () => {
    setSending(true)
    setResponse(null)
    setFetchError(null)
    setOpenLookup(null)

    const pathMap: Record<string, string> = {}
    for (const p of endpoint.pathParams) pathMap[p.name] = pathVal(p.name)
    const queryMap: Record<string, string> = {}
    for (const q of endpoint.queryParams) queryMap[q.name] = queryVal(q.name)

    const path = buildUrl(endpoint.pathTemplate, pathMap, queryMap)
    const url = `${BASE_URL}${path}`
    const init: RequestInit = {
      method: endpoint.method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    }
    if (endpoint.defaultBody !== '') init.body = bodyVal

    const t0 = nowMs()
    try {
      const res = await fetch(url, init)
      const ms = nowMs() - t0
      const body: unknown = await res.json().catch(() => null)
      setResponse({ status: res.status, ms, body })
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch')
    } finally {
      setSending(false)
    }
  }

  const toggleGroup = (group: string) =>
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }))

  const statusColor = (s: number) =>
    s >= 200 && s < 300 ? 'bg-green-100 text-green-700'
    : s >= 400 ? 'bg-red-100 text-red-700'
    : 'bg-gray-100 text-gray-600'

  const lookupKey = (paramName: string) => `${selectedId}:${paramName}`

  const renderParamInput = (p: ParamDef, value: string, onChange: (v: string) => void) => {
    const key = lookupKey(p.name)
    const isOpen = openLookup === key
    return (
      <div key={p.name} className="relative">
        <label className="mb-1 block text-xs text-gray-500">{p.label}</label>
        {p.options ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
          >
            {p.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <div className="flex gap-1.5">
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={p.placeholder}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-mono focus:border-teal-500 focus:outline-none"
            />
            {p.lookup && (
              <button
                type="button"
                onClick={() => setOpenLookup(isOpen ? null : key)}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isOpen
                    ? 'border-teal-400 bg-teal-50 text-teal-700'
                    : 'border-gray-300 text-gray-500 hover:border-teal-400 hover:text-teal-600'
                }`}
              >
                <Search className="h-3 w-3" />
                Look up
              </button>
            )}
          </div>
        )}
        {isOpen && p.lookup && (
          <LookupPopover
            kind={p.lookup}
            onSelect={(id) => onChange(id)}
            onClose={() => setOpenLookup(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">API Tester</h1>
        <p className="mt-1 text-sm text-gray-500">
          Send live requests to the clinic booking API and inspect responses.
        </p>
      </div>

      <div className="flex gap-4 items-start">
        {/* ── Endpoint list ── */}
        <aside className="w-56 shrink-0 rounded-xl border border-gray-200 bg-white overflow-hidden">
          {ENDPOINTS.map(({ group, items }) => (
            <div key={group}>
              <button
                onClick={() => toggleGroup(group)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-50"
              >
                {group}
                {collapsed[group] ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {!collapsed[group] && items.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => handleSelect(ep.id)}
                  className={`flex w-full items-center gap-2 px-4 py-2 text-left text-xs transition-colors ${
                    selectedId === ep.id ? 'bg-teal-50 text-teal-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${METHOD_COLORS[ep.method]}`}>
                    {ep.method}
                  </span>
                  <span className="truncate">{ep.label}</span>
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* ── Request + response panel ── */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
            {/* URL bar */}
            <div className="flex items-center gap-3">
              <span className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-bold ${METHOD_COLORS[endpoint.method]}`}>
                {endpoint.method}
              </span>
              <code className="flex-1 truncate rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700 font-mono border border-gray-200">
                {BASE_URL}{buildUrl(
                  endpoint.pathTemplate,
                  Object.fromEntries(endpoint.pathParams.map((p) => [p.name, pathVal(p.name) || `{${p.name}}`])),
                  Object.fromEntries(endpoint.queryParams.map((q) => [q.name, queryVal(q.name)])),
                )}
              </code>
              <button
                onClick={() => void handleSend()}
                disabled={sending}
                className="flex shrink-0 items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {sending ? <Spinner className="text-white" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </div>

            {/* Path params */}
            {endpoint.pathParams.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">Path parameters</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {endpoint.pathParams.map((p) =>
                    renderParamInput(p, pathVal(p.name), (v) => setPath(p.name, v))
                  )}
                </div>
              </div>
            )}

            {/* Query params */}
            {endpoint.queryParams.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">Query parameters</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {endpoint.queryParams.map((q) =>
                    renderParamInput(q, queryVal(q.name), (v) => setQuery(q.name, v))
                  )}
                </div>
              </div>
            )}

            {/* Request body */}
            {endpoint.defaultBody !== '' && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-500">Request body (JSON)</p>
                <textarea
                  value={bodyVal}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  spellCheck={false}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs text-gray-800 focus:border-teal-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Response */}
          {fetchError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {fetchError}
            </div>
          )}

          {response && (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
                <span className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${statusColor(response.status)}`}>
                  {response.status}
                </span>
                <span className="text-xs text-gray-400">{response.ms} ms</span>
              </div>
              <pre className="overflow-x-auto p-4 text-xs text-gray-800 leading-relaxed">
                {JSON.stringify(response.body, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
