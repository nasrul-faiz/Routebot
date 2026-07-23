import { useEffect, useMemo, useRef, useState } from "react"
import { Images, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import "lightgallery/css/lightgallery.css"
import "lightgallery/css/lg-zoom.css"
import "lightgallery/css/lg-thumbnail.css"

interface DeliveryPoint {
  code: string
  name: string
  delivery: string
  latitude: number
  longitude: number
  descriptions: { key: string; value: string }[]
  markerColor?: string
  qrCodeImageUrl?: string
  qrCodeDestinationUrl?: string
  avatarImageUrl?: string
  avatarImages?: string[]
}

interface RouteRecord {
  id: string
  name: string
  code: string
  shift: string
  color?: string | null
  deliveryPoints: unknown[]
}

type LocationImagePoint = DeliveryPoint & {
  routeId: string
  routeName: string
  routeCode: string
  routeColor?: string | null
  kilometers?: number
}

function getPointImageUrls(point: DeliveryPoint): string[] {
  const urls = [
    ...(Array.isArray(point.avatarImages) ? point.avatarImages : []),
    point.avatarImageUrl,
  ].filter((url): url is string => !!url?.trim())
  return [...new Set(urls)]
}

function uniq<T>(items: T[]) {
  return Array.from(new Set(items))
}

function ImageGridItem({ point, onImageClick }: { point: LocationImagePoint; onImageClick: (point: LocationImagePoint, imageIndex: number) => void }) {
  const images = getPointImageUrls(point)

  if (images.length === 0) return null

  return (
    <div className="group cursor-pointer">
      <div
        className="relative w-full overflow-hidden rounded-xl bg-muted aspect-square mb-3 cursor-zoom-in"
        onClick={() => onImageClick(point, 0)}
      >
        <img
          src={images[0]}
          alt={point.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300" />
        {images.length > 1 && (
          <div className="absolute top-2 right-2 flex items-center justify-center w-7 h-7 rounded-full bg-black/60 text-xs font-semibold text-white">
            {images.length}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
            {point.routeName}
          </p>
          <p className="text-sm font-semibold text-foreground truncate">{point.name}</p>
          <p className="text-xs text-muted-foreground truncate">{point.delivery || "—"}</p>
        </div>
      </div>
    </div>
  )
}

export function SiteImages() {
  const [points, setPoints] = useState<LocationImagePoint[]>([])
  const [search, setSearch] = useState("")
  const [selectedRoute, setSelectedRoute] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [currentGalleryPoint, setCurrentGalleryPoint] = useState<LocationImagePoint | null>(null)
  const [currentGalleryIndex, setCurrentGalleryIndex] = useState(0)

  const galleryHostRef = useRef<HTMLDivElement | null>(null)
  const lgInstanceRef = useRef<any>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/routes")
        const json = (await res.json()) as any
        if (!json?.success || !Array.isArray(json.data)) {
          setPoints([])
          return
        }

        const allPoints: LocationImagePoint[] = json.data.flatMap((route: RouteRecord) => {
          if (!Array.isArray(route.deliveryPoints)) return []
          return route.deliveryPoints
            .filter((point): point is DeliveryPoint => point !== null && typeof point === "object")
            .map((point) => ({
              ...point,
              routeId: route.id,
              routeName: route.name,
              routeCode: route.code,
              routeColor: route.color ?? null,
            }))
        })

        setPoints(allPoints.filter((p) => getPointImageUrls(p).length > 0))
      } catch (error) {
        console.error("[SiteImages] Failed to load route images", error)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!currentGalleryPoint || !galleryHostRef.current) {
      if (lgInstanceRef.current) {
        lgInstanceRef.current.destroy()
        lgInstanceRef.current = null
      }
      return
    }

    const init = async () => {
      await new Promise(r => setTimeout(r, 100))
      if (!galleryHostRef.current) return

      const { default: lightGallery } = await import('lightgallery')
      const { default: lgZoom } = await import('lightgallery/plugins/zoom')
      const { default: lgThumbnail } = await import('lightgallery/plugins/thumbnail')

      if (lgInstanceRef.current) {
        lgInstanceRef.current.destroy()
        lgInstanceRef.current = null
      }

      const images = getPointImageUrls(currentGalleryPoint)
      lgInstanceRef.current = lightGallery(galleryHostRef.current, {
        plugins: [lgZoom, lgThumbnail],
        speed: 300,
        download: false,
        thumbnail: true,
        dynamic: true,
        dynamicEl: images.map((url) => ({
          src: url,
          thumb: url,
          subHtml: `<h4 style="color: white; margin: 10px 0 0 0;">${currentGalleryPoint.name}</h4>`,
        })),
      })

      lgInstanceRef.current.openGallery(currentGalleryIndex)
    }

    init()

    return () => {
      if (lgInstanceRef.current) {
        lgInstanceRef.current.destroy()
        lgInstanceRef.current = null
      }
    }
  }, [currentGalleryPoint, currentGalleryIndex])

  const handleImageClick = (point: LocationImagePoint, imageIndex: number) => {
    setCurrentGalleryPoint(point)
    setCurrentGalleryIndex(imageIndex)
  }

  const routeOptions = useMemo(
    () => ["all", ...uniq(points.map((p) => p.routeName))],
    [points]
  )

  const filteredPoints = useMemo(() => {
    const q = search.trim().toLowerCase()
    return points.filter((p) => {
      if (selectedRoute !== "all" && p.routeName !== selectedRoute) return false
      if (!q) return true
      return [p.name, p.code, p.delivery, p.routeName, p.routeCode].some(
        (f) => f?.toLowerCase().includes(q)
      )
    })
  }, [points, selectedRoute, search])

  const totalPhotos = filteredPoints.reduce((sum, p) => sum + getPointImageUrls(p).length, 0)

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── Page heading ────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-5 lg:px-6 pt-5 sm:pt-6 pb-3 shrink-0">
        <PageHeader
          icon={<Images className="size-3.5" />}
          title="Site Images"
          description="Click any image to view in full gallery. Filter by route or search by name."
        />
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 lg:px-6 py-3.5 border-b border-border shrink-0 bg-card/80 backdrop-blur-sm">

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search location, code, route…"
            className="pl-9 h-8 text-xs"
          />
        </div>

        <div className="rounded-[9px] border border-border bg-background px-2.5 h-8 flex items-center">
          <select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            className="bg-transparent text-xs outline-none text-foreground"
          >
            {routeOptions.map((r) => (
              <option key={r} value={r}>{r === "all" ? "All routes" : r}</option>
            ))}
          </select>
        </div>

        {(search || selectedRoute !== "all") && (
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={() => { setSearch(""); setSelectedRoute("all") }}>
            <X className="size-3.5" />
            Reset
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
            {isLoading ? "Loading…" : `${filteredPoints.length} location${filteredPoints.length === 1 ? "" : "s"}`}
          </span>
          {!isLoading && totalPhotos > 0 && (
            <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
              · {totalPhotos} photo{totalPhotos === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto px-4 sm:px-5 lg:px-6 py-5">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="animate-pulse rounded-xl bg-muted aspect-square" />
                <div className="space-y-1">
                  <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                  <div className="h-2 bg-muted rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredPoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-card/50 py-16 text-center">
            <Images className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No location images found for this filter.</p>
            {(search || selectedRoute !== "all") && (
              <Button variant="outline" size="sm" onClick={() => { setSearch(""); setSelectedRoute("all") }}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredPoints.map((point) => (
              <ImageGridItem
                key={`${point.routeId}-${point.code}`}
                point={point}
                onImageClick={handleImageClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Hidden gallery host */}
      <div ref={galleryHostRef} className="hidden" />
    </div>
  )
}
