import { useEffect, useMemo, useState } from 'react'
import { MessageCircle, QrCode, RefreshCw, ShieldAlert, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'

type BotStatus = 'disabled' | 'starting' | 'qr' | 'connected' | 'closed' | 'reconnecting' | 'logged-out' | 'error'

type BotStatePayload = {
  enabled: boolean
  status: BotStatus
  qr: string | null
  updatedAt: string | null
  lastError: string | null
}

const STATUS_LABEL: Record<BotStatus, string> = {
  disabled: 'Disabled',
  starting: 'Starting',
  qr: 'Waiting QR Scan',
  connected: 'Connected',
  closed: 'Connection Closed',
  reconnecting: 'Reconnecting',
  'logged-out': 'Logged Out',
  error: 'Error',
}

function statusClass(status: BotStatus): string {
  if (status === 'connected') return 'text-emerald-600 dark:text-emerald-400'
  if (status === 'error' || status === 'logged-out') return 'text-red-600 dark:text-red-400'
  return 'text-amber-600 dark:text-amber-400'
}

export function BotDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<BotStatePayload | null>(null)

  const token = useMemo(() => {
    const value = new URLSearchParams(window.location.search).get('token')
    return value?.trim() || ''
  }, [])

  const fetchStatus = async () => {
    const endpoints = ['/bot/status', '/api/bot-status']
    let lastError = 'Failed to fetch bot status'

    try {
      setError(null)

      for (const endpoint of endpoints) {
        const target = token ? `${endpoint}?token=${encodeURIComponent(token)}` : endpoint
        try {
          const response = await fetch(target, {
            headers: token ? { 'x-bot-dashboard-token': token } : undefined,
          })

          const contentType = response.headers.get('content-type') || ''
          const payload = contentType.includes('application/json')
            ? await response.json()
            : { success: false, error: await response.text() }

          if (!response.ok || !payload?.success || !payload?.data) {
            const errorText = payload?.error || `Server returned ${response.status}`
            lastError = errorText
            continue
          }

          setState(payload.data as BotStatePayload)
          setError(null)
          return
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Failed to fetch bot status'
        }
      }

      setError(lastError)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch bot status'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchStatus()
    const timer = window.setInterval(() => {
      void fetchStatus()
    }, 3000)
    return () => window.clearInterval(timer)
  }, [])

  const qrImageUrl = useMemo(() => {
    if (!state?.qr) return null
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(state.qr)}`
  }, [state?.qr])

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 p-4 md:p-6">
      <div className="rounded-2xl border border-border/70 bg-card p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
              <MessageCircle className="size-5 text-green-600" />
              WhatsApp Bot Dashboard
            </h1>
            <p className="mt-1 text-xs md:text-sm text-muted-foreground">
              Scan QR untuk pair bot di WhatsApp Linked Devices dan pantau status sambungan.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchStatus()} className="gap-1.5 shrink-0">
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-4">
        <div className="rounded-2xl border border-border/70 bg-card p-4 md:p-5 flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">QR Pairing</p>
          <div className="rounded-xl border border-dashed border-border bg-muted/30 min-h-[340px] flex items-center justify-center p-3">
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading bot status...</p>
            ) : error ? (
              <div className="text-center px-4">
                <ShieldAlert className="size-8 text-red-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">Tidak dapat ambil status bot</p>
                <p className="text-[11px] text-muted-foreground mt-1 break-words">{error}</p>
              </div>
            ) : state?.status === 'connected' ? (
              <div className="text-center px-4">
                <Wifi className="size-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold">Bot sudah connected</p>
                <p className="text-[11px] text-muted-foreground mt-1">QR tak diperlukan selagi sesi masih aktif.</p>
              </div>
            ) : qrImageUrl ? (
              <img src={qrImageUrl} alt="WhatsApp QR" className="w-[300px] h-[300px] max-w-full max-h-full rounded-lg bg-white p-2" />
            ) : (
              <div className="text-center px-4">
                <QrCode className="size-8 text-muted-foreground/60 mx-auto mb-2" />
                <p className="text-sm font-semibold">QR belum tersedia</p>
                <p className="text-[11px] text-muted-foreground mt-1">Pastikan ENABLE_WHATSAPP_BOT=true dan server telah restart.</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 md:p-5 flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Connection Status</p>

          <div className="rounded-xl border border-border bg-background px-3 py-2.5">
            <p className={`text-sm font-bold ${state ? statusClass(state.status) : 'text-muted-foreground'}`}>
              {state ? STATUS_LABEL[state.status] : 'Unknown'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Updated: {state?.updatedAt ? new Date(state.updatedAt).toLocaleString() : '-'}</p>
            <p className="text-[11px] text-muted-foreground">Enabled: {state?.enabled ? 'Yes' : 'No'}</p>
            <p className="text-[11px] text-muted-foreground">Last error: {state?.lastError ?? '-'}</p>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">Cara scan QR</p>
            <ol className="mt-1 text-[11px] text-muted-foreground list-decimal pl-4 space-y-0.5">
              <li>Buka WhatsApp di telefon.</li>
              <li>Pergi ke Linked Devices.</li>
              <li>Tekan Link a Device.</li>
              <li>Scan QR di panel sebelah kiri.</li>
            </ol>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">
              Jika status sentiasa error, semak env Railway: ENABLE_WHATSAPP_BOT, APP_BASE_URL, AUTH_DIR, dan volume persistence.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
