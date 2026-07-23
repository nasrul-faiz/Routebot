import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet"
import L from "leaflet"

const INITIAL_MARKER_RENDER = 64
const MARKER_RENDER_CHUNK = 96

const DELIVERY_COLORS: Record<string, string> = {
  Daily:      "#22c55e",
  "Alt 1":    "#f59e0b",
  "Alt 2":    "#a855f7",
  Weekday:   "#3b82f6",
  "Weekday 2": "#3b82f6",
  "Weekday 3": "#6366f1",
}

interface DeliveryPoint {
  code: string
  name: string
  delivery: string
  latitude: number
  longitude: number
  descriptions: { key: string; value: string }[]
  markerColor?: string
  routeLabel?: string
  routeId?: string
}

interface DeliveryMapProps {
  deliveryPoints: DeliveryPoint[]
  scrollZoom?: boolean
  showPolyline?: boolean
  markerStyle?: "pin" | "dot" | "ring"
  mapStyle?: "google-streets" | "google-satellite" | "osm"
  startPoint?: { lat: number; lng: number }
  includeStartInBounds?: boolean
  refitToken?: number
  resizeToken?: number
  onResetRoute?: () => void
  focusPoint?: { lat: number; lng: number } | null
  focusToken?: number
  visiblePointCodes?: Set<string> | null
}

interface TileConfigItem {
  attribution: string
  url: string
  subdomains: string[]
  maxZoom: number
  maxNativeZoom: number
}

function isDeliveryOnToday(delivery: string, date: Date = new Date()): boolean {
  const dayOfWeek = date.getDay() // 0=Sun, 1=Mon, ...
  const localNoon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
  const epochDay = Math.floor(localNoon.getTime() / 86400000)

  switch (delivery) {
    case "Daily":
      return true
    case "Alt 1":
      return epochDay % 2 !== 0
    case "Alt 2":
      return epochDay % 2 === 0
    case "Weekday":
      return dayOfWeek >= 0 && dayOfWeek <= 4
    case "Weekday 2":
      return dayOfWeek >= 1 && dayOfWeek <= 5
    case "Weekday 3":
      return [0, 2, 4].includes(dayOfWeek)
    default:
      return true
  }
}

const TILE_CONFIG: Record<"google-streets" | "google-satellite" | "osm", TileConfigItem> = {
  "google-streets": {
    attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: ["a", "b", "c"],
    maxZoom: 19,
    maxNativeZoom: 19,
  },
  "google-satellite": {
    attribution: "Source: ESRI World Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    subdomains: [],
    maxZoom: 20,
    maxNativeZoom: 20,
  },
  osm: {
    attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors &copy; <a href='https://carto.com/attributions'>CARTO</a>",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    subdomains: ["a", "b", "c", "d"],
    maxZoom: 20,
    maxNativeZoom: 19,
  },
}

function createPinIcon(color: string, active = false): L.Icon {
  const size: [number, number]   = active ? [18, 30] : [14, 24]
  const anchor: [number, number] = [size[0] / 2, size[1]]
  const gradient = `${color}cc`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="${size[0]}" height="${size[1]}">
    <defs>
      <linearGradient id="pinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${gradient}" stop-opacity="1"/>
      </linearGradient>
      <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.25"/>
      </filter>
    </defs>
    <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="url(#pinGrad)" stroke="#ffffff" stroke-width="1.8" filter="url(#pinShadow)"/>
    <circle cx="12.5" cy="12.5" r="4.5" fill="#ffffff" opacity="0.95"/>
    <ellipse cx="12.5" cy="8.5" rx="3.4" ry="1.8" fill="#ffffff" opacity="0.45"/>
  </svg>`
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

  return L.icon({
    iconUrl: url,
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: [0, -(size[1] + 6)],
    tooltipAnchor: [0, -size[1]],
  })
}

function createDotIcon(color: string, active = false): L.DivIcon {
  const size = active ? 12 : 10
  return L.divIcon({
    className: "",
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size + 6)],
    html: `<div style="position:relative;width:${size}px;height:${size}px;border-radius:999px;background:radial-gradient(circle at 40% 40%, #ffffffcc, ${color});border:2px solid #ffffff;box-shadow:0 0 0 1px ${color}66,0 3px 8px rgba(0,0,0,0.18)"></div>`,
  })
}

function createRingIcon(color: string, active = false): L.DivIcon {
  const outer = active ? 16 : 12
  const inner = active ? 7 : 5
  return L.divIcon({
    className: "",
    iconAnchor: [outer / 2, outer / 2],
    popupAnchor: [0, -(outer + 6)],
    html: `<div style="position:relative;width:${outer}px;height:${outer}px;border-radius:999px;background:#ffffff;border:2px solid ${color};box-shadow:0 0 0 1px ${color}55,0 3px 10px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center"><div style="width:${inner}px;height:${inner}px;border-radius:999px;background:${color};box-shadow:inset 0 0 0 1px rgba(255,255,255,0.6)"></div></div>`,
  })
}

function createMarkerIcon(style: "pin" | "dot" | "ring", color: string, active = false): L.Icon | L.DivIcon {
  if (style === "dot") return createDotIcon(color, active)
  if (style === "ring") return createRingIcon(color, active)
  return createPinIcon(color, active)
}

const markerIconCache = new Map<string, L.Icon | L.DivIcon>()

function getCachedMarkerIcon(style: "pin" | "dot" | "ring", color: string, active = false): L.Icon | L.DivIcon {
  const key = `${style}|${color}|${active ? 1 : 0}`
  const cached = markerIconCache.get(key)
  if (cached) return cached
  const created = createMarkerIcon(style, color, active)
  markerIconCache.set(key, created)
  return created
}

// Badge html shown on grouped markers (count > 1)
const stackBadge = (count: number, color: string) =>
  `<div style="position:absolute;top:-6px;right:-8px;background:${color};color:#fff;border-radius:999px;font-size:9px;font-weight:700;padding:1px 4px;line-height:1.2;border:1.5px solid #ffffffcc;min-width:16px;text-align:center;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,0.18)">${count}</div>`

function createGroupedIcon(
  style: "pin" | "dot" | "ring",
  color: string,
  count: number,
  active = false
): L.Icon | L.DivIcon {
  if (count <= 1) return getCachedMarkerIcon(style, color, active)

  const badge = stackBadge(count, color)

  if (style === "dot") {
    const size = active ? 12 : 10
    return L.divIcon({
      className: "",
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size + 6)],
      html: `<div style="position:relative;display:inline-block"><div style="width:${size}px;height:${size}px;border-radius:999px;background:radial-gradient(circle at 40% 40%, #ffffffcc, ${color});border:2px solid #ffffff;box-shadow:0 0 0 1px ${color}66,0 3px 10px rgba(0,0,0,0.18)"></div>${badge}</div>`,
    })
  }

  if (style === "ring") {
    const outer = active ? 16 : 12
    const inner = active ? 7 : 5
    return L.divIcon({
      className: "",
      iconAnchor: [outer / 2, outer / 2],
      popupAnchor: [0, -(outer + 6)],
      html: `<div style="position:relative;display:inline-block"><div style="width:${outer}px;height:${outer}px;border-radius:999px;background:#ffffff;border:2px solid ${color};box-shadow:0 0 0 1px ${color}55,0 3px 10px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center"><div style="width:${inner}px;height:${inner}px;border-radius:999px;background:${color};box-shadow:inset 0 0 0 1px rgba(255,255,255,0.6)"></div></div>${badge}</div>`,
    })
  }

  const w = active ? 18 : 14
  const h = active ? 30 : 24
  const svgPin = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="${w}" height="${h}"><defs><linearGradient id="pinGradGroup" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${color}cc"/></linearGradient></defs><path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="url(#pinGradGroup)" stroke="#ffffff" stroke-width="1.8"/><circle cx="12.5" cy="12.5" r="4.5" fill="#ffffff" opacity="0.95"/></svg>`
  return L.divIcon({
    className: "",
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -(h + 6)],
    html: `<div style="position:relative;display:inline-block;box-shadow:0 3px 12px rgba(0,0,0,0.18);border-radius:999px;">${svgPin}${badge}</div>`,
  })
}

const groupedIconCache = new Map<string, L.Icon | L.DivIcon>()

function getCachedGroupedIcon(style: "pin" | "dot" | "ring", color: string, count: number, active = false): L.Icon | L.DivIcon {
  const key = `${style}|${color}|${count}|${active ? 1 : 0}`
  const cached = groupedIconCache.get(key)
  if (cached) return cached
  const created = createGroupedIcon(style, color, count, active)
  groupedIconCache.set(key, created)
  return created
}

/** Fits map bounds whenever validPoints changes */
function BoundsController({ points, startPoint, includeStartInBounds = true, refitToken }: { points: DeliveryPoint[]; startPoint?: { lat: number; lng: number }; includeStartInBounds?: boolean; refitToken?: number }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0 && !startPoint) return

    if (points.length === 0 && startPoint) {
      map.setView([startPoint.lat, startPoint.lng], 14)
      return
    }

    const bounds = L.latLngBounds(points.map(p => [p.latitude, p.longitude] as [number, number]))
    if (startPoint && includeStartInBounds) bounds.extend([startPoint.lat, startPoint.lng])

    if (bounds.isValid() && bounds.getSouthWest().equals(bounds.getNorthEast())) {
      map.setView([points[0].latitude, points[0].longitude], 14)
    } else {
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [map, points, startPoint, includeStartInBounds, refitToken])
  return null
}

function MapReadyController({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap()
  useEffect(() => {
    onReady(map)
  }, [map, onReady])
  return null
}

function MapInteractionWatcher({ onStart, onEnd }: { onStart: () => void; onEnd: () => void }) {
  useMapEvents({
    movestart: onStart,
    zoomstart: onStart,
    dragstart: onStart,
    moveend: onEnd,
    zoomend: onEnd,
    dragend: onEnd,
  })
  return null
}

function ResizeController({ resizeToken }: { resizeToken?: number }) {
  const map = useMap()

  useEffect(() => {
    // Fullscreen/container transitions need delayed invalidation so Leaflet recalculates final size.
    map.invalidateSize(false)
    const t1 = window.setTimeout(() => map.invalidateSize(false), 120)
    const t2 = window.setTimeout(() => map.invalidateSize(false), 280)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [map, resizeToken])

  return null
}

function FlyToController({ target, token }: { target?: { lat: number; lng: number } | null; token?: number }) {
  const map = useMap()
  const lastToken = useRef(0)

  useEffect(() => {
    if (!token || token === lastToken.current) return
    lastToken.current = token
    if (!target) return
    const targetZoom = Math.max(map.getZoom(), 16)
    map.flyTo([target.lat, target.lng], targetZoom, { duration: 0.8 })
  }, [token, target, map])

  return null
}

interface GroupedMarkerItemProps {
  points: DeliveryPoint[]
  markerStyle: "pin" | "dot" | "ring"
  color: string
  isActive: boolean
  groupKey: string
  onActivate: (groupKey: string) => void
  onDeactivate: (groupKey: string) => void
}

const GroupedMarkerItem = memo(function GroupedMarkerItem({ points, markerStyle, color, isActive, groupKey, onActivate, onDeactivate }: GroupedMarkerItemProps) {
  const markerRef = useRef<L.Marker | null>(null)
  const first = points[0]

  useEffect(() => {
    if (!markerRef.current) return
    if (isActive) {
      markerRef.current.openPopup()
    } else {
      markerRef.current.closePopup()
    }
  }, [isActive])

  return (
    <Marker
      ref={markerRef}
      position={[first.latitude, first.longitude]}
      icon={getCachedGroupedIcon(markerStyle, color, points.length, isActive)}
      eventHandlers={{
        popupopen: () => onActivate(groupKey),
        popupclose: () => onDeactivate(groupKey),
      }}
    >
      <Popup autoPan={false}>
        <div style={{ fontFamily: "system-ui, sans-serif", minWidth: 160, padding: "2px 0" }}>
          {points.map((p, i) => (
            <div
              key={`${p.routeId ?? ""}-${p.code}`}
              style={i > 0 ? { marginTop: 6, paddingTop: 6, borderTop: "1px solid #e5e7eb" } : undefined}
            >
              <p style={{ margin: 0, fontWeight: 700, fontSize: 12, color: "#111", lineHeight: 1.35 }}>
                {p.code} — {p.name}
              </p>
              {p.routeLabel && (
                <p style={{ margin: "2px 0 0", fontSize: 10, color: "#6b7280" }}>{p.routeLabel}</p>
              )}
            </div>
          ))}
        </div>
      </Popup>
    </Marker>
  )
}, (prev, next) => (
  prev.points === next.points
  && prev.markerStyle === next.markerStyle
  && prev.color === next.color
  && prev.isActive === next.isActive
  && prev.groupKey === next.groupKey
  && prev.onActivate === next.onActivate
  && prev.onDeactivate === next.onDeactivate
))

export function DeliveryMap({ deliveryPoints, scrollZoom = false, showPolyline = false, markerStyle = "pin", mapStyle = "osm", startPoint, includeStartInBounds = true, refitToken = 0, resizeToken = 0, onResetRoute, focusPoint, focusToken = 0, visiblePointCodes = null }: DeliveryMapProps) {
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null)
  const [renderedMarkerCount, setRenderedMarkerCount] = useState(INITIAL_MARKER_RENDER)
  const [activeMapStyle, setActiveMapStyle] = useState<typeof mapStyle>(mapStyle)
  const [showPolylineState, setShowPolylineState] = useState<boolean>(showPolyline)
  const [markerStyleState, setMarkerStyleState] = useState<typeof markerStyle>(markerStyle)

  useEffect(() => { setActiveMapStyle(mapStyle) }, [mapStyle])
  useEffect(() => { setShowPolylineState(showPolyline) }, [showPolyline])
  useEffect(() => { setMarkerStyleState(markerStyle) }, [markerStyle])

  const tiles = TILE_CONFIG[activeMapStyle]
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const activateGroup = useCallback((key: string) => {
    setActiveGroupKey(key)
  }, [])

  const deactivateGroup = useCallback((key: string) => {
    setActiveGroupKey((prev) => (prev === key ? null : prev))
  }, [])

  const validPoints = useMemo(
    () => {
      let points = deliveryPoints.filter(p => p.latitude !== 0 && p.longitude !== 0)
      if (visiblePointCodes != null) {
        points = points.filter(p => visiblePointCodes.has(p.code))
      }
      return points
    },
    [deliveryPoints, visiblePointCodes]
  )
  const deferredPoints = useDeferredValue(validPoints)

  // Render marker nodes progressively to avoid long first-paint stalls on large routes.
  useEffect(() => {
    setRenderedMarkerCount(INITIAL_MARKER_RENDER)
  }, [deferredPoints.length, activeMapStyle, markerStyleState])

  useEffect(() => {
    if (renderedMarkerCount >= deferredPoints.length) return

    let cancelled = false
    const schedule =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? (cb: () => void) => (window as Window & { requestIdleCallback: (fn: () => void) => number }).requestIdleCallback(cb)
        : (cb: () => void) => window.setTimeout(cb, 16)
    const cancel =
      typeof window !== "undefined" && "cancelIdleCallback" in window
        ? (id: number) => (window as Window & { cancelIdleCallback: (x: number) => void }).cancelIdleCallback(id)
        : (id: number) => window.clearTimeout(id)

    const id = schedule(() => {
      if (cancelled) return
      setRenderedMarkerCount((prev) => Math.min(prev + MARKER_RENDER_CHUNK, deferredPoints.length))
    })

    return () => {
      cancelled = true
      cancel(id)
    }
  }, [renderedMarkerCount, deferredPoints.length])

  const renderedPoints = useMemo(
    () => deferredPoints.slice(0, Math.min(renderedMarkerCount, deferredPoints.length)),
    [deferredPoints, renderedMarkerCount]
  )

  useEffect(() => {
    if (!focusToken || !focusPoint) return
    setRenderedMarkerCount(deferredPoints.length)
    setActiveGroupKey(`${focusPoint.lat.toFixed(6)},${focusPoint.lng.toFixed(6)}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken])

  const mapRef = useRef<L.Map | null>(null)
  const [controlsVisible, setControlsVisible] = useState(true)
  const showControlsTimer = useRef<number | null>(null)
  const maxHideTimer = useRef<number | null>(null)

  const setMapRef = useCallback((map: L.Map) => {
    mapRef.current = map
  }, [])

  const handleInteractStart = useCallback(() => {
    if (showControlsTimer.current) { window.clearTimeout(showControlsTimer.current); showControlsTimer.current = null }
    setControlsVisible(false)
    // Safety net: never let the controls stay hidden if an end event is missed.
    if (maxHideTimer.current) window.clearTimeout(maxHideTimer.current)
    maxHideTimer.current = window.setTimeout(() => setControlsVisible(true), 2500)
  }, [])

  const handleInteractEnd = useCallback(() => {
    if (showControlsTimer.current) window.clearTimeout(showControlsTimer.current)
    showControlsTimer.current = window.setTimeout(() => setControlsVisible(true), 450)
  }, [])

  useEffect(() => () => {
    if (showControlsTimer.current) window.clearTimeout(showControlsTimer.current)
    if (maxHideTimer.current) window.clearTimeout(maxHideTimer.current)
  }, [])

  const initialBounds = useMemo(() => {
    if (deferredPoints.length === 0 && !startPoint) return null

    const bounds = deferredPoints.length > 0
      ? L.latLngBounds(deferredPoints.map(p => [p.latitude, p.longitude] as [number, number]))
      : L.latLngBounds([[startPoint!.lat, startPoint!.lng], [startPoint!.lat, startPoint!.lng]])

    if (startPoint && includeStartInBounds) {
      bounds.extend([startPoint.lat, startPoint.lng])
    }

    return bounds.isValid() ? bounds : null
  }, [deferredPoints, startPoint, includeStartInBounds])

  const resetView = useCallback(() => {
    if (!mapRef.current || !initialBounds) return

    if (initialBounds.getSouthWest().equals(initialBounds.getNorthEast())) {
      mapRef.current.setView(initialBounds.getCenter(), 14)
    } else {
      mapRef.current.fitBounds(initialBounds, { padding: [40, 40] })
    }
  }, [initialBounds])

  // Group co-located points (same lat/lng) into a single marker
  const groupedMarkers = useMemo(() => {
    const map = new Map<string, { points: DeliveryPoint[]; color: string }>()
    renderedPoints.forEach((p) => {
      const key = `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`
      const color = p.markerColor ?? DELIVERY_COLORS[p.delivery] ?? "#6b7280"
      const existing = map.get(key)
      if (!existing) {
        map.set(key, { points: [p], color })
      } else {
        existing.points.push(p)
        // Deterministic color regardless of sort/insertion order for mixed-route groups.
        if (color < existing.color) existing.color = color
      }
    })
    return Array.from(map.entries()).map(([key, { points, color }]) => ({ key, points, color }))
  }, [renderedPoints])

  const center = useMemo((): [number, number] => {
    if (startPoint) return [startPoint.lat, startPoint.lng]
    if (deferredPoints.length === 0) return [3.15, 101.65]
    return [
      deferredPoints.reduce((s, p) => s + p.latitude,  0) / deferredPoints.length,
      deferredPoints.reduce((s, p) => s + p.longitude, 0) / deferredPoints.length,
    ]
  }, [deferredPoints, startPoint])

  const polylineGroups = useMemo(() => {
    if (!showPolylineState) return [] as Array<{ id: string; positions: [number, number][] }>

    // Polyline follows only locations that are active for today's delivery schedule.
    const polylinePoints = deferredPoints.filter((point) => isDeliveryOnToday(point.delivery))

    const grouped = new Map<string, [number, number][]>();
    polylinePoints.forEach((point) => {
      const groupId = point.routeId ?? "single-route"
      const positions = grouped.get(groupId) ?? (startPoint ? [[startPoint.lat, startPoint.lng]] as [number, number][] : [])
      positions.push([point.latitude, point.longitude])
      grouped.set(groupId, positions)
    })

    return Array.from(grouped.entries())
      .map(([id, positions]) => ({ id, positions }))
      .filter((item) => item.positions.length >= 2)
  }, [deferredPoints, showPolylineState, startPoint])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={center}
        zoom={13}
        zoomControl={false}
        preferCanvas={true}
        zoomAnimation={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
        scrollWheelZoom={scrollZoom}
        style={{ width: "100%", height: "100%" }}
      >
        <MapReadyController onReady={setMapRef} />
        <MapInteractionWatcher onStart={handleInteractStart} onEnd={handleInteractEnd} />
      <TileLayer
        key={activeMapStyle}
        attribution={tiles.attribution}
        url={tiles.url}
        subdomains={tiles.subdomains}
        maxZoom={tiles.maxZoom}
        maxNativeZoom={tiles.maxNativeZoom}
        updateWhenIdle={false}
        updateWhenZooming={false}
        keepBuffer={4}
        detectRetina={false}
        crossOrigin={true}
      />
      <ResizeController resizeToken={resizeToken} />
      <BoundsController points={deferredPoints} startPoint={startPoint} includeStartInBounds={includeStartInBounds} refitToken={refitToken} />
      <FlyToController target={focusPoint} token={focusToken} />
      {startPoint && (
        <Marker
          key="start-point"
          position={[startPoint.lat, startPoint.lng]}
          icon={getCachedMarkerIcon(markerStyleState, "#111111", false)}
        >
          <Popup autoPan={false}>
            <div style={{ fontFamily: "system-ui, sans-serif", minWidth: 120 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#111" }}>QL Kitchen</p>
            </div>
          </Popup>
        </Marker>
      )}
      {polylineGroups.map((group) => (
        <Polyline
          key={group.id}
          positions={group.positions}
          pathOptions={{ color: "#2563eb", weight: 3, opacity: 0.75 }}
        />
      ))}
      {groupedMarkers.map(({ key, points, color }) => (
        <GroupedMarkerItem
          key={key}
          points={points}
          markerStyle={markerStyleState}
          color={color}
          isActive={activeGroupKey === key}
          groupKey={key}
          onActivate={activateGroup}
          onDeactivate={deactivateGroup}
        />
      ))}
      </MapContainer>

      {/* Control panel overlay */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, pointerEvents: 'none', opacity: controlsVisible ? 1 : 0, transform: controlsVisible ? 'translateY(0)' : 'translateY(-6px)', transition: 'opacity 0.25s ease, transform 0.25s ease' }}>
        <div style={{ pointerEvents: controlsVisible ? 'auto' : 'none', background: 'color-mix(in srgb, var(--card) 88%, transparent)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: 10, padding: 4, border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)', boxShadow: '0 2px 10px color-mix(in srgb, var(--foreground) 12%, transparent)', display: 'flex', gap: 3, alignItems: 'center', color: 'var(--foreground)' }}>
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <button aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--foreground)', fontSize: 15, lineHeight: 1, cursor: 'pointer' }}>+</button>
            <button aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--foreground)', fontSize: 15, lineHeight: 1, cursor: 'pointer' }}>−</button>
          </div>
          <span style={{ width: 1, height: 16, background: 'color-mix(in srgb, var(--border) 70%, transparent)' }} />
          <select
            value={activeMapStyle}
            onChange={(e) => setActiveMapStyle(e.target.value as typeof activeMapStyle)}
            style={{
              height: 28,
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--border) 50%, transparent)',
              background: 'color-mix(in srgb, var(--card) 92%, transparent)',
              color: 'var(--foreground)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '0 10px',
            }}
          >
            <option value="google-streets">Streets</option>
            <option value="google-satellite">Satellite</option>
            <option value="osm">OSM</option>
          </select>
          <button onClick={() => setShowPolylineState(s => !s)} style={{ height: 24, borderRadius: 6, padding: '0 8px', border: 'none', background: showPolylineState ? 'var(--primary)' : 'transparent', color: showPolylineState ? 'var(--primary-foreground)' : 'var(--foreground)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{showPolylineState ? 'Route On' : 'Route Off'}</button>
          <select value={markerStyleState} onChange={(e) => setMarkerStyleState(e.target.value as any)} style={{ height: 24, borderRadius: 6, padding: '0 4px', border: 'none', background: 'transparent', color: 'var(--foreground)', fontSize: 11, cursor: 'pointer' }}>
            <option value="pin">Pin</option>
            <option value="dot">Dot</option>
            <option value="ring">Ring</option>
          </select>
          <span style={{ width: 1, height: 16, background: 'color-mix(in srgb, var(--border) 70%, transparent)' }} />
          <button aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={() => {
            if (!document.fullscreenElement) {
              containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
            } else {
              document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
            }
          }} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--foreground)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            {isFullscreen ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
            )}
          </button>
        </div>
      </div>
      {(initialBounds || onResetRoute) && (
        <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 5, opacity: controlsVisible ? 1 : 0, transform: controlsVisible ? 'translateY(0)' : 'translateY(6px)', transition: 'opacity 0.25s ease, transform 0.25s ease', pointerEvents: controlsVisible ? 'auto' : 'none' }}>
          {initialBounds && (
            <button
              type="button"
              onClick={resetView}
              aria-label="Kembali ke view"
              title="Kembali ke view"
              style={{
                border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
                borderRadius: 999,
                width: 28,
                height: 28,
                padding: 0,
                display: 'grid',
                placeItems: 'center',
                background: 'color-mix(in srgb, var(--card) 88%, transparent)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: 'var(--foreground)',
                boxShadow: '0 2px 10px color-mix(in srgb, var(--foreground) 12%, transparent)',
                cursor: 'pointer',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10a9 9 0 0 1 9-9v4l3-3-3-3v4a7 7 0 0 0-7 7 7 7 0 0 0 7 7 7 7 0 0 0 7-7h-2" />
              </svg>
            </button>
          )}
          {onResetRoute && (
            <button
              type="button"
              onClick={onResetRoute}
              aria-label="Return view to this route"
              title="Return view to this route"
              style={{
                border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
                borderRadius: 999,
                width: 28,
                height: 28,
                padding: 0,
                display: 'grid',
                placeItems: 'center',
                background: 'color-mix(in srgb, var(--card) 88%, transparent)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: 'var(--foreground)',
                boxShadow: '0 2px 10px color-mix(in srgb, var(--foreground) 12%, transparent)',
                cursor: 'pointer',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
