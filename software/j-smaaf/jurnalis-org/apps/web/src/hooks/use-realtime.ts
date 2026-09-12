'use client'

import { useEffect, useRef } from 'react'

type RealtimeHandler = (event: string, payload: unknown) => void

export function useRealtime(onMessage: RealtimeHandler, enabled = true) {
  const handlerRef = useRef<RealtimeHandler>(onMessage)
  handlerRef.current = onMessage

  useEffect(() => {
    if (!enabled) return
    let ws: WebSocket | null = null
    let closed = false
    let timer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (closed) return
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${window.location.host}/ws`)
      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data as string) as { event: string; payload: unknown }
          handlerRef.current(parsed.event, parsed.payload)
        } catch {
          // abaikan pesan non-JSON
        }
      }
      ws.onclose = () => {
        if (!closed) {
          timer = setTimeout(connect, 3000)
        }
      }
    }
    connect()

    return () => {
      closed = true
      if (timer) clearTimeout(timer)
      ws?.close()
    }
  }, [enabled])
}
