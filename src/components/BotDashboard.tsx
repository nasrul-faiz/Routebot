import { useEffect, useMemo, useState } from 'react'
import { MessageCircle, QrCode, RefreshCw, ShieldAlert, Wifi, Phone, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

type BotStatus = 'disabled' | 'starting' | 'qr' | 'pairing-phone' | 'pairing-code' | 'connected' | 'closed' | 'reconnecting' | 'logged-out' | 'error'

type BotStatePayload = {
  enabled: boolean
  status: BotStatus
  qr: string | null
  pairingMethod: 'qr' | 'phone' | null
  pairingPhoneNumber: string | null
  pairingCode: string | null
  updatedAt: string | null
  lastError: string | null
}

const STATUS_LABEL: Record<BotStatus, string> = {
  disabled: 'Disabled',
  starting: 'Starting',
  qr: 'Waiting QR Scan',
  'pairing-phone': 'Pairing Phone',
  'pairing-code': 'Pairing Code Ready',
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

  const isPhonePairing = state?.pairingMethod === 'phone' || state?.status === 'pairing-phone' || state?.status === 'pairing-code'

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
              Pair bot melalui QR code atau nombor telefon, kemudian pantau status sambungan.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchStatus()} className="gap-1.5 shrink-0">
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-4">
        <div className="rounded-2xl border border-border/70 bg-card p-4 md:p-5 flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Pairing</p>
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
                {state.pairingMethod ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">Paired via: {state.pairingMethod === 'phone' ? 'Phone number' : 'QR code'}</p>
                ) : null}
              </div>
            ) : state?.status === 'pairing-code' && state.pairingCode ? (
              <div className="text-center px-4 w-full">
                <Phone className="size-8 text-sky-500 mx-auto mb-2" />
                <p className="text-sm font-semibold">Phone pairing ready</p>
                <p className="text-[11px] text-muted-foreground mt-1">Masukkan code ini dalam WhatsApp &gt; Linked Devices &gt; Link with phone number.</p>
                <code className="mt-3 block rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono tracking-[0.25em] break-all">
                  {state.pairingCode}
                </code>
                {state.pairingPhoneNumber ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">Nombor: {state.pairingPhoneNumber}</p>
                ) : null}
              </div>
            ) : state?.status === 'pairing-phone' ? (
              <div className="text-center px-4">
                <Phone className="size-8 text-sky-500 mx-auto mb-2" />
                <p className="text-sm font-semibold">Menjana pairing code...</p>
                <p className="text-[11px] text-muted-foreground mt-1">Tunggu seketika, bot sedang minta code daripada WhatsApp.</p>
                {state.pairingPhoneNumber ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">Nombor: {state.pairingPhoneNumber}</p>
                ) : null}
              </div>
            ) : qrImageUrl && !isPhonePairing ? (
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
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">Cara pair bot</p>
            <ol className="mt-1 text-[11px] text-muted-foreground list-decimal pl-4 space-y-0.5">
              <li>Pilih QR code jika mahu scan kod.</li>
              <li>Pilih nombor telefon jika mahu dapat pairing code.</li>
              <li>QR mode guna Linked Devices &gt; Link a Device.</li>
              <li>Phone mode guna Linked Devices &gt; Link with phone number.</li>
            </ol>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Pairing method</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
              <span className={`rounded-full px-2 py-1 ${state?.pairingMethod === 'qr' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-background text-muted-foreground'}`}>QR</span>
              <span className={`rounded-full px-2 py-1 ${state?.pairingMethod === 'phone' ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300' : 'bg-background text-muted-foreground'}`}>Phone</span>
              <span className="text-muted-foreground">Current: {state?.pairingMethod || 'unknown'}</span>
            </div>
            {state?.pairingPhoneNumber ? (
              <p className="mt-2 text-[11px] text-muted-foreground">Phone: {state.pairingPhoneNumber}</p>
            ) : null}
            {state?.pairingCode ? (
              <div className="mt-2 rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Pairing code</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <code className="font-mono text-sm tracking-[0.25em] break-all">{state.pairingCode}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={async () => {
                      if (!state.pairingCode) return
                      await navigator.clipboard.writeText(state.pairingCode)
                    }}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">
              Jika status sentiasa error, semak env Railway: ENABLE_WHATSAPP_BOT, APP_BASE_URL, AUTH_DIR, BOT_PAIRING_METHOD, dan volume persistence.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
