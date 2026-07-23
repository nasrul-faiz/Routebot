import { useState, useEffect, useMemo, useCallback } from "react"
import { Truck, Cog, MapPinned, TableProperties, Info, Check } from "lucide-react"
import { DeliveryMap } from "@/components/DeliveryMap"
import { RowInfoModal } from "@/components/RowInfoModal"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface SharedDeliveryPoint {
  code: string
  name: string
  delivery: string
  latitude: number
  longitude: number
  descriptions: { key: string; value: string }[]
}

interface SharedColumnDef {
  key: string
  label: string
}

export interface SharedRouteData {
  routeName: string
  routeCode: string
  routeShift: string
  routeColor?: string
  points: SharedDeliveryPoint[]
  columns: SharedColumnDef[]
  createdAt: string
}

const KL_KITCHEN: { lat: number; lng: number } = { lat: 3.0695500, lng: 101.5469179 }

function isDeliveryActive(delivery: string): boolean {
  return delivery.toLowerCase() !== 'inactive'
}

function getThemeClass(): string {
  try {
    const mode = localStorage.getItem('fcalendar_color_mode') ?? localStorage.getItem('colorMode') ?? 'dark'
    return mode === 'dark' ? 'dark' : ''
  } catch {
    return 'dark'
  }
}

function getMapStylePref(): 'google-streets' | 'google-satellite' | 'osm' {
  try {
    const v = localStorage.getItem('fcalendar_map_style')
    if (v === 'google-streets' || v === 'google-satellite' || v === 'osm') return v
  } catch { /* */ }
  return 'google-streets'
}

interface Props {
  code: string
}

export function SharedRoutePage({ code }: Props) {
  const [data, setData] = useState<SharedRouteData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [themeClass, setThemeClass] = useState(getThemeClass)

  const [view, setView] = useState<'table' | 'map'>('table')
  const [mapRefitToken, setMapRefitToken] = useState(0)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [visibleColKeys, setVisibleColKeys] = useState<Set<string>>(new Set())
  const [mapStyle, setMapStyle] = useState<'google-streets' | 'google-satellite' | 'osm'>(getMapStylePref)
  const [markerStyle, setMarkerStyle] = useState<'pin' | 'dot' | 'ring'>('pin')
  const [showPolyline, setShowPolyline] = useState(false)

  const [search, setSearch] = useState('')

  const [infoPoint, setInfoPoint] = useState<SharedDeliveryPoint | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    fetch(`${base}/api/share/${encodeURIComponent(code)}`)
      .then(res => {
        if (!res.ok) { setNotFound(true); return null }
        return res.json()
      })
      .then(json => {
        if (!json) return
        const d = json as SharedRouteData
        setData(d)
        setVisibleColKeys(new Set(d.columns.filter(c => c.key !== 'action').map(c => c.key)))
      })
      .catch(() => setNotFound(true))
  }, [code])

  useEffect(() => {
    const obs = new MutationObserver(() => setThemeClass(getThemeClass()))
    obs.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', themeClass === 'dark')
  }, [themeClass])

  const toggleView = useCallback(() => {
    setView(v => {
      if (v === 'table') { setMapRefitToken(t => t + 1); return 'map' }
      return 'table'
    })
  }, [])

  const visibleCols = useMemo(
    () => (data?.columns ?? []).filter(c => c.key !== 'action' && visibleColKeys.has(c.key)),
    [data, visibleColKeys]
  )

  const filteredPoints = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase().trim()
    if (!q) return data.points
    return data.points.filter(p =>
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.delivery.toLowerCase().includes(q)
    )
  }, [data, search])

  const mapDeliveryPoints = useMemo(() => {
    if (!data) return []
    return data.points.map(p => ({
      ...p,
      markerColor: data.routeColor ?? '#06b6d4',
    }))
  }, [data])

  if (notFound) {
    return (
      <div className={`${themeClass} min-h-screen bg-background text-foreground flex items-center justify-center`}>
        <div className="text-center space-y-2 p-8">
          <p className="text-2xl font-bold">Link not found</p>
          <p className="text-muted-foreground text-sm">This share link may have expired or been deleted.</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className={`${themeClass} min-h-screen bg-background text-foreground flex items-center justify-center`}>
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    )
  }

  const markerColor = data.routeColor ?? '#06b6d4'
  const nameLower = (data.routeName + ' ' + data.routeCode).toLowerCase()
  const isKL = nameLower.includes('kl')
  const isSel = nameLower.includes('sel')

  return (
    <div className={`${themeClass} fixed inset-0 bg-background text-foreground flex flex-col overflow-hidden`}>

      {/* ── Header ── */}
      <div className="shrink-0 border-b border-border bg-background">
        <div className="px-5 py-3 flex items-center gap-3">
          {isKL ? (
            <img src="/kl-flag.png" className="object-cover shadow-sm ring-1 ring-black/10 dark:ring-white/10 shrink-0" style={{ width: 28, height: 17, borderRadius: 3 }} alt="KL" />
          ) : isSel ? (
            <img src="/selangor-flag.png" className="object-cover shadow-sm ring-1 ring-black/10 dark:ring-white/10 shrink-0" style={{ width: 28, height: 17, borderRadius: 3 }} alt="Selangor" />
          ) : (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${markerColor}25`, boxShadow: `0 0 0 1.5px ${markerColor}50` }}>
              <Truck className="size-4" style={{ color: markerColor }} />
            </div>
          )}

          <h1 className="flex-1 min-w-0 text-[12px] font-bold leading-tight truncate">
            {data.routeName}{' '}
            <span className="text-muted-foreground font-medium">( {data.routeCode} )</span>
          </h1>

          <span className="shrink-0 text-[9px] font-bold px-2 py-0.5 rounded" style={{
            background: data.routeShift === 'AM' ? 'hsl(38 100% 50% / 0.15)' : 'hsl(250 60% 55% / 0.15)',
            color: data.routeShift === 'AM' ? 'hsl(38 95% 45%)' : 'hsl(250 80% 70%)',
          }}>
            {data.routeShift}
          </span>

          {/* Settings */}
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="shrink-0 w-[32px] h-[32px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <Cog className="size-[15px]" />
          </button>

          {/* Map / Table toggle */}
          <button
            onClick={toggleView}
            title={view === 'table' ? 'Switch to Map' : 'Switch to Table'}
            className="shrink-0 w-[32px] h-[32px] flex items-center justify-center rounded-lg transition-colors hover:bg-muted/60"
            style={{ color: view === 'map' ? markerColor : 'hsl(var(--muted-foreground))' }}
          >
            {view === 'table' ? <MapPinned className="size-[15px]" /> : <TableProperties className="size-[15px]" />}
          </button>
        </div>
      </div>

      {/* ── Map view ── */}
      {view === 'map' && (
        <div className="flex-1 min-h-0">
          <DeliveryMap
            deliveryPoints={mapDeliveryPoints}
            scrollZoom={true}
            showPolyline={showPolyline}
            markerStyle={markerStyle}
            mapStyle={mapStyle}
            startPoint={KL_KITCHEN}
            includeStartInBounds={false}
            refitToken={mapRefitToken}
          />
        </div>
      )}

      {/* ── Table view ── */}
      {view === 'table' && (
        <>
          {/* Search bar */}
          <div className="shrink-0 border-b border-border/70 bg-background/95 px-3 py-2.5 flex items-center gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by code, name, delivery..."
                className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-10 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto min-h-0">
            <table className="border-collapse text-[11px] whitespace-nowrap min-w-max w-full text-center [&_th]:!text-center [&_td]:!text-center [&_th]:align-middle [&_td]:align-middle">
              <thead className="sticky top-0 z-10 backdrop-blur-sm" style={{ background: 'hsl(var(--background)/0.92)' }}>
                <tr className="text-center">
                  {visibleCols.map(col => (
                    <th key={col.key} className="px-4 h-10 text-center text-[9px] font-bold uppercase tracking-wider bg-background/95 border-b border-border/70" style={{ color: 'hsl(var(--foreground)/0.72)' }}>
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 h-10 text-center text-[9px] font-bold uppercase tracking-wider bg-background/95 border-b border-border/70" style={{ color: 'hsl(var(--foreground)/0.72)' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Starting point row */}
                <tr className="bg-background hover:bg-muted/30 transition-colors duration-100 text-center">
                  {visibleCols.map(col => {
                    if (col.key === 'no') return <td key="no" className="px-4 h-9 text-center"><span className="text-[9px] font-semibold tabular-nums" style={{ color: markerColor }}>∞</span></td>
                    if (col.key === 'code') return <td key="code" className="px-4 h-9 text-center"><span className="text-[9px] font-semibold">QLK</span></td>
                    if (col.key === 'name') return <td key="name" className="px-3 h-9 text-center"><span className="text-[9px] font-semibold">QL Kitchen</span></td>
                    if (col.key === 'delivery') return <td key="delivery" className="px-3 h-9 text-center"><span className="text-[9px] font-semibold">Available</span></td>
                    if (col.key === 'km') return <td key="km" className="px-3 h-9 text-center"><span className="text-[9px] font-semibold tabular-nums">0 Km</span></td>
                    return <td key={col.key} className="px-4 h-9" />
                  })}
                  {/* Action — starting point info button */}
                  <td className="px-3 h-9 text-center">
                    <div className="inline-flex items-center gap-1 justify-center">
                      <button
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150 hover:scale-110 active:scale-95 text-emerald-600 hover:bg-emerald-500/10"
                        title="QL Kitchen info"
                        onClick={() => {
                          setInfoPoint({
                            code: 'QLK',
                            name: 'QL Kitchen',
                            delivery: 'Available',
                            latitude: KL_KITCHEN.lat,
                            longitude: KL_KITCHEN.lng,
                            descriptions: [],
                          })
                          setInfoOpen(true)
                        }}
                      >
                        <Info className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>

                {filteredPoints.length === 0 && search ? (
                  <tr><td colSpan={visibleCols.length + 1} className="py-10 text-center">
                    <p className="text-sm font-semibold text-foreground">No matching delivery point</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Try a different keyword.</p>
                  </td></tr>
                ) : filteredPoints.length === 0 ? (
                  <tr><td colSpan={visibleCols.length + 1} className="py-10 text-center">
                    <p className="text-sm font-semibold">No delivery points</p>
                  </td></tr>
                ) : null}

                {filteredPoints.map((point, index) => {
                  const active = isDeliveryActive(point.delivery)
                  return (
                    <tr key={point.code} className={`transition-colors duration-100 text-center ${
                      active
                        ? index % 2 === 0 ? 'bg-background hover:bg-muted/30' : 'bg-muted/20 hover:bg-muted/35'
                        : 'bg-muted/30 text-muted-foreground/80 hover:bg-muted/45'
                    }`}>
                      {visibleCols.map(col => {
                        if (col.key === 'no') return (
                          <td key="no" className="px-4 h-9 text-center">
                            <span className="text-[9px] font-semibold tabular-nums" style={{ color: markerColor }}>
                              {data.points.indexOf(point) + 1}
                            </span>
                          </td>
                        )
                        if (col.key === 'code') return <td key="code" className="px-4 h-9 text-center"><span className="text-[9px] font-semibold">{point.code}</span></td>
                        if (col.key === 'name') return <td key="name" className="px-3 h-9 text-center min-w-[120px]"><span className="text-[11px]">{point.name}</span></td>
                        if (col.key === 'delivery') return (
                          <td key="delivery" className="px-3 h-9 text-center">
                            <span className="text-[9px] font-medium px-2 py-0.5 rounded-full" style={{
                              background: active ? 'hsl(var(--primary)/0.1)' : 'hsl(var(--muted))',
                              color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                            }}>
                              {point.delivery}
                            </span>
                          </td>
                        )
                        if (col.key === 'km') return <td key="km" className="px-3 h-9 text-center"><span className="text-[9px] tabular-nums text-muted-foreground">—</span></td>
                        return <td key={col.key} className="px-4 h-9" />
                      })}
                      {/* Action column */}
                      <td className="px-3 h-9 text-center">
                        <div className="inline-flex items-center gap-1 justify-center">
                          <button
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150 hover:scale-110 active:scale-95 ${
                              active ? 'text-emerald-600 hover:bg-emerald-500/10' : 'text-rose-500 hover:bg-rose-500/10'
                            }`}
                            onClick={() => { setInfoPoint(point); setInfoOpen(true) }}
                          >
                            <Info className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Info modal (read-only) ── */}
      {infoPoint && (
        <RowInfoModal
          open={infoOpen}
          onOpenChange={setInfoOpen}
          point={infoPoint}
          isEditMode={false}
          allowMarkerColorEdit={false}
        />
      )}

      {/* ── Settings dialog ── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="w-[90vw] max-w-xs rounded-2xl border border-border/60 bg-card p-0 gap-0 overflow-hidden shadow-xl">
          <DialogDescription className="sr-only">Table and map settings</DialogDescription>
          <div className="px-4 pt-4 pb-3 border-b border-border/50">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Cog className="size-4 text-muted-foreground" />
              Settings
            </DialogTitle>
          </div>

          <div className="px-4 py-3 space-y-4 overflow-auto max-h-[70vh]">

            {/* Column visibility */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Columns</p>
              <div className="space-y-1">
                {(data?.columns ?? []).filter(c => c.key !== 'action').map(col => {
                  const on = visibleColKeys.has(col.key)
                  return (
                    <button
                      key={col.key}
                      onClick={() => setVisibleColKeys(prev => {
                        const next = new Set(prev)
                        if (next.has(col.key)) next.delete(col.key)
                        else next.add(col.key)
                        return next
                      })}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-[12px]">{col.label}</span>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${on ? 'bg-primary border-primary' : 'border-border'}`}>
                        {on && <Check className="size-2.5 text-primary-foreground" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Map settings */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Map Style</p>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { value: 'google-streets', label: 'Streets' },
                  { value: 'google-satellite', label: 'Satellite' },
                  { value: 'osm', label: 'OSM' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMapStyle(opt.value)}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-colors ${
                      mapStyle === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Marker Style</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(['pin', 'dot', 'ring'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setMarkerStyle(s)}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-colors capitalize ${
                      markerStyle === s
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowPolyline(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <span className="text-[12px]">Show route line</span>
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${showPolyline ? 'bg-primary border-primary' : 'border-border'}`}>
                {showPolyline && <Check className="size-2.5 text-primary-foreground" />}
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
