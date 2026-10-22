import { useEffect, useReducer } from 'react'
import { extractErrorMessage } from '../api/types'

interface State<T> {
  data: T | null
  loading: boolean
  error: string | null
}

type Action<T> =
  | { type: 'start' }
  | { type: 'done'; data: T }
  | { type: 'fail'; error: string }

function reducer<T>(state: State<T>, action: Action<T>): State<T> {
  switch (action.type) {
    case 'start': return { data: state.data, loading: true, error: null }
    case 'done':  return { data: action.data, loading: false, error: null }
    case 'fail':  return { data: null, loading: false, error: action.error }
  }
}

interface UseApiResult<T> extends State<T> {
  reload: () => void
}

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): UseApiResult<T> {
  const [state, dispatch] = useReducer(reducer<T>, { data: null, loading: true, error: null })
  const [tick, reload] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    let cancelled = false
    dispatch({ type: 'start' })
    fetcher()
      .then((data) => { if (!cancelled) dispatch({ type: 'done', data }) })
      .catch((err: unknown) => {
        if (!cancelled) dispatch({ type: 'fail', error: extractErrorMessage(err) })
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  return { ...state, reload }
}
