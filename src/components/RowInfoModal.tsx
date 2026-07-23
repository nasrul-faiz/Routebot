import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import QrScanner from "qr-scanner"
import { Plus, Trash2, QrCode, ExternalLink, Pencil, Link2, ImageUp, X, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Check, Camera, ChevronRight, Video, Play } from "lucide-react"
import { toast } from "sonner"
import { LoadingSpinner } from "@/components/ui/loading"
import "lightgallery/css/lightgallery.css"
import "lightgallery/css/lg-zoom.css"
import "lightgallery/css/lg-thumbnail.css"
import "lightgallery/css/lg-video.css"
const noImageSrc = "/noimagefond.png"
const fallbackNoImageSrc = "https://images.pexels.com/photos/1170986/pexels-photo-1170986.jpeg?auto=compress&cs=tinysrgb&w=100"

let lgModulesCache: { lightGallery: any; lgZoom: any; lgThumbnail: any; lgVideo: any } | null = null
async function loadLGModules() {
  if (lgModulesCache) return lgModulesCache
  const [{ default: lightGallery }, { default: lgZoom }, { default: lgThumbnail }, { default: lgVideo }] =
    await Promise.all([
      import('lightgallery'),
      import('lightgallery/plugins/zoom'),
      import('lightgallery/plugins/thumbnail'),
      import('lightgallery/plugins/video'),
    ])
  lgModulesCache = { lightGallery, lgZoom, lgThumbnail, lgVideo }
  return lgModulesCache
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { uploadImageToImgBB } from "@/lib/imgbb"

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

interface RowInfoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  point: DeliveryPoint
  isEditMode: boolean
  allowMarkerColorEdit?: boolean
  onSave?: (updated: DeliveryPoint) => void
  overlayClassName?: string
}

const DEFAULT_MARKER_COLOR = "#ef4444"
const MAX_AVATAR_MEDIA_ITEMS = 8

const isHexColor = (value: string) => /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value)

const VIDEO_EXTENSION_RE = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i

const extractYoutubeId = (url: string): string | null => {
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/)
  if (short?.[1]) return short[1]
  const long = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/)
  if (long?.[1]) return long[1]
  const embed = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/)
  return embed?.[1] ?? null
}

const extractVimeoId = (url: string): string | null => {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/)
  return match?.[1] ?? null
}

const isVideoMediaUrl = (url: string): boolean => {
  if (!url) return false
  const trimmed = url.trim()
  if (/^data:video\//i.test(trimmed)) return true
  if (extractYoutubeId(trimmed) || extractVimeoId(trimmed)) return true
  return VIDEO_EXTENSION_RE.test(trimmed)
}

const getVideoMimeFromUrl = (url: string): string => {
  const dataUrlMatch = url.match(/^data:(video\/[a-zA-Z0-9.+-]+);/i)
  if (dataUrlMatch?.[1]) return dataUrlMatch[1].toLowerCase()
  const lower = url.toLowerCase()
  if (lower.endsWith(".webm")) return "video/webm"
  if (lower.endsWith(".ogg")) return "video/ogg"
  if (lower.endsWith(".mov")) return "video/quicktime"
  if (lower.endsWith(".m4v")) return "video/x-m4v"
  return "video/mp4"
}

const getVideoPoster = (url: string): string => {
  const youtubeId = extractYoutubeId(url)
  if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
  return noImageSrc
}

const createVideoDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Failed to read video file"))
    reader.readAsDataURL(file)
  })

export function RowInfoModal({ open, onOpenChange, point, isEditMode, allowMarkerColorEdit = false, onSave, overlayClassName }: RowInfoModalProps) {
  const [drafts, setDrafts] = useState<{ key: string; value: string }[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [markerColor, setMarkerColor] = useState<string | undefined>(undefined)
  const [markerColorInput, setMarkerColorInput] = useState("")
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState("")
  const [qrCodeDestinationUrl, setQrCodeDestinationUrl] = useState("")
  const [showQRDialog, setShowQRDialog] = useState(false)
  const [qrTab, setQrTab] = useState<"url" | "media">("url")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const [pendingUrlLabel, setPendingUrlLabel] = useState<string>("")

  // Avatar image state
  const [avatarImageUrl, setAvatarImageUrl] = useState("") // selected display image
  const [avatarImages, setAvatarImages] = useState<string[]>([]) // all uploaded images
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  // Dialog draft state
  const [dialogImages, setDialogImages] = useState<string[]>([])
  const [dialogSelected, setDialogSelected] = useState("")
  const [avatarTab, setAvatarTab] = useState<"url" | "upload-image" | "upload-video">("url")
  const [avatarUrlInput, setAvatarUrlInput] = useState("")
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarVideoUploading, setAvatarVideoUploading] = useState(false)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const avatarVideoFileRef = useRef<HTMLInputElement>(null)
  const avatarGalleryHostRef = useRef<HTMLDivElement | null>(null)
  const avatarLGInstance = useRef<any>(null)
  const avatarLGSignatureRef = useRef("")

  const avatarGalleryItems = useMemo(
    () =>
      avatarImages.map((url) => {
        if (!isVideoMediaUrl(url)) {
          return {
            src: url,
            thumb: url,
            subHtml: `<h4>${point.name}</h4>`,
          }
        }

        const poster = getVideoPoster(url)
        if (extractYoutubeId(url) || extractVimeoId(url)) {
          return {
            src: url,
            thumb: poster,
            poster,
            subHtml: `<h4>${point.name}</h4><p>Video</p>`,
          }
        }

        return {
          src: url,
          thumb: poster,
          poster,
          subHtml: `<h4>${point.name}</h4><p>Video</p>`,
          video: {
            source: [{ src: url, type: getVideoMimeFromUrl(url) }],
            attributes: {
              preload: false,
              controls: true,
              playsinline: true,
            },
          },
        }
      }),
    [avatarImages, point.name]
  )

  const avatarGallerySignature = useMemo(
    () => avatarGalleryItems.map((item) => item.src).join("||"),
    [avatarGalleryItems]
  )

  useEffect(() => {
    if (open) {
      setDrafts(point.descriptions ?? [])
      setMarkerColor(point.markerColor)
      setMarkerColorInput(point.markerColor ?? "")
      setQrCodeImageUrl(point.qrCodeImageUrl ?? "")
      setQrCodeDestinationUrl(point.qrCodeDestinationUrl ?? "")
      const imgs = point.avatarImages ?? (point.avatarImageUrl ? [point.avatarImageUrl] : [])
      setAvatarImages(imgs)
      setAvatarImageUrl(point.avatarImageUrl ?? (imgs[0] ?? noImageSrc))
      setIsEditing(false)
    }
  }, [open, point])

  const destroyAvatarGallery = useCallback(() => {
    if (!avatarLGInstance.current) return
    avatarLGInstance.current.destroy()
    avatarLGInstance.current = null
    avatarLGSignatureRef.current = ""
  }, [])

  const ensureAvatarGallery = useCallback(async () => {
    if (!avatarGalleryHostRef.current || avatarImages.length === 0) return false

    if (avatarLGInstance.current && avatarLGSignatureRef.current === avatarGallerySignature) {
      return true
    }

    // Wait two animation frames so Dialog layout settles before gallery init.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    if (!avatarGalleryHostRef.current) return false

    const { lightGallery, lgZoom, lgThumbnail, lgVideo } = await loadLGModules()
    if (!avatarGalleryHostRef.current) return false

    destroyAvatarGallery()
    avatarLGInstance.current = lightGallery(avatarGalleryHostRef.current, {
      plugins: [lgZoom, lgThumbnail, lgVideo],
      speed: 300,
      download: false,
      thumbnail: true,
      dynamic: true,
      dynamicEl: avatarGalleryItems,
    })
    avatarLGSignatureRef.current = avatarGallerySignature
    return true
  }, [avatarGalleryItems, avatarGallerySignature, avatarImages.length, destroyAvatarGallery])

  useEffect(() => {
    if (!open || isEditMode || avatarImages.length === 0) {
      destroyAvatarGallery()
    }
  }, [open, isEditMode, avatarImages.length, destroyAvatarGallery])

  useEffect(() => {
    return () => destroyAvatarGallery()
  }, [destroyAvatarGallery])

  const openAvatarGallery = async () => {
    if (avatarImages.length === 0) return
    const ready = await ensureAvatarGallery()
    if (!ready || !avatarLGInstance.current) return
    const idx = avatarImages.indexOf(avatarImageUrl)
    avatarLGInstance.current.openGallery(idx >= 0 ? idx : 0)
  }

  const [isUploadingQR, setIsUploadingQR] = useState(false)
  const [qrDecodeStatus, setQrDecodeStatus] = useState<"idle" | "decoding" | "decoded" | "failed">("idle")

  // Decode QR code from a data URL or Blob using qr-scanner
  const decodeQrFromSource = async (source: string | Blob): Promise<string | null> => {
    try {
      const result = await QrScanner.scanImage(source, { returnDetailedScanResult: true })
      return result.data ?? null
    } catch {
      return null
    }
  }

  // Upload QR image file → ImgBB (no base64 bloat in DB)
  const handleQrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingQR(true)
    setQrDecodeStatus("decoding")
    try {
      const url = await uploadImageToImgBB(file)
      setQrCodeImageUrl(url)
      const decoded = await decodeQrFromSource(file)
      if (decoded) {
        setQrDecodeStatus("decoded")
        setQrCodeDestinationUrl(decoded)
      } else {
        setQrDecodeStatus("failed")
      }
    } catch {
      setQrDecodeStatus("failed")
    } finally {
      setIsUploadingQR(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const hasCoords = point.latitude !== 0 && point.longitude !== 0

  // Detect unsaved changes in the editing form
  const hasChanges = useMemo(() => {
    const filteredDrafts = drafts.filter(d => d.key.trim() !== "")
    const originalDescs = (point.descriptions ?? []).filter(d => d.key.trim() !== "")
    if (filteredDrafts.length !== originalDescs.length) return true
    for (let i = 0; i < filteredDrafts.length; i++) {
      if (filteredDrafts[i].key !== originalDescs[i]?.key || filteredDrafts[i].value !== originalDescs[i]?.value) return true
    }
    if ((markerColor ?? undefined) !== (point.markerColor ?? undefined)) return true
    return false
  }, [drafts, markerColor, point.descriptions, point.markerColor])

  const handleAdd = () => setDrafts(prev => [...prev, { key: "", value: "" }])
  const handleRemove = (i: number) => setDrafts(prev => prev.filter((_, idx) => idx !== i))
  const handleChange = (i: number, field: "key" | "value", val: string) =>
    setDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d))

  const handleSave = () => {
    try {
      onSave?.({
        ...point,
        descriptions: drafts.filter(d => d.key.trim() !== ""),
        markerColor,
        qrCodeImageUrl,
        qrCodeDestinationUrl,
        avatarImageUrl,
        avatarImages,
      })
      setIsEditing(false)
      toast.success("Changes saved", {
        description: `${point.name || point.code} updated successfully.`,
        icon: <CheckCircle2 className="size-4 text-primary" />,
        duration: 3000,
      })
    } catch {
      toast.error("Failed to save", {
        description: "Please try again.",
        icon: <AlertCircle className="size-4" />,
        duration: 4000,
      })
    }
  }

  const handleCancel = () => {
    setDrafts(point.descriptions ?? [])
    setMarkerColor(point.markerColor)
    setMarkerColorInput(point.markerColor ?? "")
    setIsEditing(false)
  }

  const gmapsUrl = `https://maps.google.com/?q=${point.latitude},${point.longitude}`
  const wazeUrl = `https://waze.com/ul?ll=${point.latitude},${point.longitude}&navigate=yes`
  const familyMartUrl = `https://fmvending.web.app/refill-service/M${String(point.code).padStart(4, "0")}`

  const openUrl = (url: string, label = "") => {
    if (pendingUrlLabel === label) {
      setPendingUrl(null)
      setPendingUrlLabel("")
      return
    }
    setPendingUrl(url)
    setPendingUrlLabel(label)
  }
  const confirmOpen = () => {
    if (pendingUrl) {
      window.open(pendingUrl, "_blank")
      setPendingUrl(null)
      setPendingUrlLabel("")
    }
  }

  const validateMediaUrl = async (url: string): Promise<{ kind: "image" | "video" }> => {
    const response = await fetch(`/api/validate-media-url?url=${encodeURIComponent(url)}`)
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error ?? "Invalid media URL")
    }
    return payload.data as { kind: "image" | "video" }
  }

  const handleDialogInteractOutside = (event: Event) => {
    const target = event.target as HTMLElement | null
    if (!target) return
    // lightGallery is rendered in a portal outside this dialog; keep modal open while interacting with gallery UI.
    if (target.closest(".lg-outer") || target.closest(".lg-backdrop") || target.closest(".lg-container")) {
      event.preventDefault()
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setPendingUrl(null); setPendingUrlLabel("") } onOpenChange(o) }}>
      <DialogContent
        onInteractOutside={handleDialogInteractOutside}
        overlayClassName={overlayClassName ?? "bg-black/18 dark:bg-black/45"}
        className="flex max-h-[min(80vh,36rem)] w-[93vw] max-w-[22.5rem] transform-gpu flex-col gap-0 overflow-hidden rounded-[22px] border border-sidebar-border/80 bg-[hsl(var(--sidebar)/0.9)] text-sidebar-foreground p-0 shadow-[0_10px_24px_hsl(var(--foreground)/0.12)] data-[state=open]:duration-150 data-[state=closed]:duration-100 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 dark:border-border/80 dark:bg-card dark:text-foreground dark:shadow-[0_14px_30px_hsl(var(--background)/0.5)] md:max-w-[23.5rem]"
      >
        {/* Header */}
        <DialogHeader className="shrink-0 border-b border-sidebar-border/80 bg-gradient-to-b from-[hsl(var(--sidebar)/0.95)] to-[hsl(var(--sidebar)/0.75)] px-4 pt-4 pb-3 text-left dark:border-border dark:from-background/75 dark:to-card/35 md:px-5 md:pt-5 md:pb-4">
          <div className="flex items-center gap-2.5 md:gap-3">
            {/* Avatar: multi-image gallery / camera-slash placeholder */}
            {isEditMode ? (
              <button
                onClick={() => {
                  setDialogImages([...avatarImages])
                  setDialogSelected(avatarImageUrl)
                  setAvatarUrlInput("")
                  setAvatarTab("url")
                  setShowAvatarDialog(true)
                }}
                className="group relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted shadow focus:outline-none md:size-14"
              >
                {avatarImageUrl ? (
                  isVideoMediaUrl(avatarImageUrl) ? (
                    <div className="relative size-full rounded-full bg-muted">
                      <img
                        src={getVideoPoster(avatarImageUrl)}
                        alt={point.name}
                        className="size-full rounded-full object-cover"
                        onError={(event) => { event.currentTarget.src = fallbackNoImageSrc }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35">
                        <Play className="size-4 text-white md:size-5" />
                      </div>
                    </div>
                  ) : (
                    <img src={avatarImageUrl} alt={point.name} className="size-full rounded-full object-cover" />
                  )
                ) : (
                  <img
                    src={noImageSrc}
                    alt="No image"
                    className="size-full rounded-full object-cover"
                    onError={(event) => { event.currentTarget.src = fallbackNoImageSrc }}
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/35 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="size-4 text-white md:size-5" />
                </div>
              </button>
            ) : (
              avatarImages.length > 0 ? (
                <>
                  <button
                    onClick={openAvatarGallery}
                    className="relative flex size-11 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-full bg-muted shadow focus:outline-none md:size-14"
                  >
                    {isVideoMediaUrl(avatarImageUrl || avatarImages[0]) ? (
                      <div className="relative size-full rounded-full bg-muted">
                        <img
                          src={getVideoPoster(avatarImageUrl || avatarImages[0])}
                          alt={point.name}
                          className="size-full rounded-full object-cover"
                          onError={(event) => { event.currentTarget.src = fallbackNoImageSrc }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35">
                          <Play className="size-4 text-white md:size-5" />
                        </div>
                      </div>
                    ) : (
                      <img src={avatarImageUrl || avatarImages[0]} alt={point.name} className="size-full rounded-full object-cover" />
                    )}
                    {avatarImages.length > 1 && (
                      <span className="absolute -right-0.5 -bottom-0.5 rounded-full bg-foreground/75 px-1 py-0.5 text-[9px] leading-none text-background md:px-1.5 md:py-1 md:text-[10px]">
                        {avatarImages.length}
                      </span>
                    )}
                  </button>
                </>
              ) : (
                <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted shadow md:size-14">
                  <img
                    src={noImageSrc}
                    alt="No image"
                    className="size-full rounded-full object-cover"
                    onError={(event) => { event.currentTarget.src = fallbackNoImageSrc }}
                  />
                </div>
              )
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle className="truncate text-[11px] font-bold text-foreground md:text-[13px] md:leading-tight">
                {point.name}
              </DialogTitle>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="text-[11px] font-mono text-muted-foreground">{point.code}</span>
                <span className="text-[11px] text-muted-foreground/60">•</span>
                <span className="text-[9px] text-muted-foreground">{point.delivery}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden bg-[hsl(var(--sidebar)/0.45)] px-4 py-3 dark:bg-background/35 md:px-5 md:py-4">
          {/* Information section */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Information</p>
              {isEditMode && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-[11px] text-primary hover:text-primary/80 font-medium px-2 py-0.5 rounded-md hover:bg-primary/10 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                {allowMarkerColorEdit && (
                  <div className="rounded-md border border-border/70 bg-muted/40 p-2.5">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Marker Color</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={markerColor ?? DEFAULT_MARKER_COLOR}
                        onChange={(e) => {
                          setMarkerColor(e.target.value)
                          setMarkerColorInput(e.target.value)
                        }}
                        className="h-8 w-10 cursor-pointer rounded border border-border bg-background p-1"
                        aria-label="Marker color"
                      />
                      <Input
                        placeholder="#ef4444"
                        value={markerColorInput}
                        onChange={(e) => {
                          const next = e.target.value
                          setMarkerColorInput(next)
                          const normalized = next.trim()
                          if (!normalized) {
                            setMarkerColor(undefined)
                            return
                          }
                          if (isHexColor(normalized)) setMarkerColor(normalized)
                        }}
                        className="h-8 flex-1 text-[10px] md:text-[10px]"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-[9px]"
                        onClick={() => {
                          setMarkerColor(undefined)
                          setMarkerColorInput("")
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                )}
                {drafts.map((d, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      placeholder="Key"
                      value={d.key}
                      onChange={e => handleChange(i, "key", e.target.value)}
                      className="w-28 h-8 text-[10px] md:text-[10px]"
                    />
                    <Input
                      placeholder="Value"
                      value={d.value}
                      onChange={e => handleChange(i, "value", e.target.value)}
                      className="flex-1 h-8 text-[10px] md:text-[10px]"
                    />
                    <button
                      onClick={() => handleRemove(i)}
                      className="theme-danger shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={handleAdd}
                  className="theme-accent-blue mt-1 flex items-center gap-1 text-[11px] font-medium"
                >
                  <Plus className="size-3.5" />
                  Add field
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl">
                {drafts && drafts.length > 0 ? (
                  <dl className="space-y-1.5">
                    {drafts.map((d, i) => (
                      <div key={i} className="grid grid-cols-[84px_1fr] items-start gap-x-2.5 px-2 py-1">
                        <dt className="text-[11px] font-medium text-muted-foreground text-left">{d.key}</dt>
                        <dd className="text-[10px] font-normal text-foreground text-left leading-relaxed">{d.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-[11px] text-muted-foreground text-center py-5">No information added</p>
                )}
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          {!isEditing && (
            <div className="mt-3 pt-1 pb-2">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Open With</p>
              <div className="flex flex-col gap-1.5">

                {/* Google Maps row */}
                {hasCoords && (
                  <div className="overflow-hidden rounded-xl border border-border/80 bg-background/70 shadow-[inset_0_1px_0_hsl(var(--background)/0.7)]">
                    <div className="transition-transform duration-200 ease-out will-change-transform" style={{ display: 'grid', gridTemplateColumns: '100% 100%', transform: pendingUrlLabel === 'Google Maps' ? 'translateX(-100%)' : 'translateX(0)' }}>
                      <button onClick={() => openUrl(gmapsUrl, "Google Maps")} className="group flex w-full items-center gap-2 bg-muted/35 px-2.5 py-0.5 transition-colors hover:bg-muted/65 active:opacity-75">
                        <img src="/Gmaps.png" alt="Google Maps" className="h-5 w-5 rounded-md object-cover shrink-0" />
                        <span className="flex-1 text-left text-[11px] font-semibold text-foreground">Google Maps</span>
                        <ChevronRight className="size-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
                      </button>
                      <div className="relative overflow-hidden bg-background/80">
                        <div className="absolute inset-y-0 left-0 w-1" style={{ background: 'linear-gradient(to bottom,#4285F4,#34A853)' }} />
                        <div className="flex items-center gap-2 px-3 py-1 pl-5">
                          <button
                            onClick={() => openUrl(gmapsUrl, "Google Maps")}
                            className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                          >
                            <img src="/Gmaps.png" alt="Google Maps" className="h-5 w-5 rounded-md object-cover shrink-0" />
                            <p className="min-w-0 truncate text-[11px] font-semibold text-foreground leading-tight">Open Google Maps?</p>
                          </button>
                          <div className="flex items-center shrink-0">
                            <button onClick={confirmOpen} aria-label="Open Google Maps URL" className="theme-accent-blue flex h-6 w-6 items-center justify-center rounded-full transition-colors active:scale-95"><ExternalLink className="h-3 w-3" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Waze row */}
                {hasCoords && (
                  <div className="overflow-hidden rounded-xl border border-border/80 bg-background/70 shadow-[inset_0_1px_0_hsl(var(--background)/0.7)]">
                    <div className="transition-transform duration-200 ease-out will-change-transform" style={{ display: 'grid', gridTemplateColumns: '100% 100%', transform: pendingUrlLabel === 'Waze' ? 'translateX(-100%)' : 'translateX(0)' }}>
                      <button onClick={() => openUrl(wazeUrl, "Waze")} className="group flex w-full items-center gap-2 bg-muted/35 px-2.5 py-0.5 transition-colors hover:bg-muted/65 active:opacity-75">
                        <img src="/waze.png" alt="Waze" className="h-5 w-5 rounded-md object-cover shrink-0" />
                        <span className="flex-1 text-left text-[11px] font-semibold text-foreground">Waze</span>
                        <ChevronRight className="size-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
                      </button>
                      <div className="relative overflow-hidden bg-background/80">
                        <div className="absolute inset-y-0 left-0 w-1" style={{ background: 'linear-gradient(to bottom,#33CCFF,#05C8F0)' }} />
                        <div className="flex items-center gap-2 px-3 py-1 pl-5">
                          <button
                            onClick={() => openUrl(wazeUrl, "Waze")}
                            className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                          >
                            <img src="/waze.png" alt="Waze" className="h-5 w-5 rounded-md object-cover shrink-0" />
                            <p className="min-w-0 truncate text-[11px] font-semibold text-foreground leading-tight">Open Waze?</p>
                          </button>
                          <div className="flex items-center shrink-0">
                            <button onClick={confirmOpen} aria-label="Open Waze URL" className="theme-accent-blue flex h-6 w-6 items-center justify-center rounded-full transition-colors active:scale-95"><ExternalLink className="h-3 w-3" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* FamilyMart row — only for numeric codes */}
                {/^\d+$/.test(point.code) && (
                    <div className="overflow-hidden rounded-xl border border-border/80 bg-background/70 shadow-[inset_0_1px_0_hsl(var(--background)/0.7)]">
                  <div className="transition-transform duration-200 ease-out will-change-transform" style={{ display: 'grid', gridTemplateColumns: '100% 100%', transform: pendingUrlLabel === 'FamilyMart' ? 'translateX(-100%)' : 'translateX(0)' }}>
                      <button onClick={() => openUrl(familyMartUrl, "FamilyMart")} className="group flex w-full items-center gap-2 bg-muted/35 px-2.5 py-0.5 transition-colors hover:bg-muted/65 active:opacity-75">
                      <img src="/FamilyMart.png" alt="FamilyMart" className="h-5 w-5 rounded-md object-cover shrink-0" />
                      <span className="flex-1 text-left text-[11px] font-semibold text-foreground">FamilyMart</span>
                      <ChevronRight className="size-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </button>
                    <div className="relative overflow-hidden bg-background/80">
                      <div className="absolute inset-y-0 left-0 w-1" style={{ background: 'linear-gradient(to bottom,#007140,#00A651)' }} />
                        <div className="flex items-center gap-2 px-3 py-1 pl-5">
                        <button
                          onClick={() => openUrl(familyMartUrl, "FamilyMart")}
                          className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                        >
                          <img src="/FamilyMart.png" alt="FamilyMart" className="h-5 w-5 rounded-md object-cover shrink-0" />
                          <p className="min-w-0 truncate text-[11px] font-semibold text-foreground leading-tight">Open FamilyMart?</p>
                        </button>
                        <div className="flex items-center shrink-0">
                          <button onClick={confirmOpen} aria-label="Open FamilyMart URL" className="theme-accent-emerald flex h-6 w-6 items-center justify-center rounded-full transition-colors active:scale-95"><ExternalLink className="h-3 w-3" /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* QR Code row — view mode, slides like other rows */}
                {!isEditMode && qrCodeDestinationUrl && (
                  <div className="overflow-hidden rounded-xl border border-border/80 bg-background/70 shadow-[inset_0_1px_0_hsl(var(--background)/0.7)]">
                    <div className="transition-transform duration-200 ease-out will-change-transform" style={{ display: 'grid', gridTemplateColumns: '100% 100%', transform: pendingUrlLabel === 'QR Code' ? 'translateX(-100%)' : 'translateX(0)' }}>
                      <button onClick={() => openUrl(qrCodeDestinationUrl, "QR Code")} className="group flex w-full items-center gap-2 bg-muted/35 px-2.5 py-0.5 transition-colors hover:bg-muted/65 active:opacity-75">
                        <QrCode className="h-5 w-5 text-orange-500 shrink-0 p-1" />
                        <span className="flex-1 text-left text-[11px] font-semibold text-foreground">QR Code</span>
                        <ChevronRight className="size-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
                      </button>
                      <div className="relative overflow-hidden bg-background/80">
                        <div className="absolute inset-y-0 left-0 w-1" style={{ background: 'linear-gradient(to bottom,#f97316,#ea580c)' }} />
                        <div className="flex items-center gap-2 px-3 py-1 pl-5">
                          <button
                            onClick={() => openUrl(qrCodeDestinationUrl, "QR Code")}
                            className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                          >
                            <QrCode className="h-5 w-5 text-orange-500 shrink-0 p-1" />
                            <p className="min-w-0 truncate text-[11px] font-semibold text-foreground leading-tight">Open QR Code?</p>
                          </button>
                          <div className="flex items-center shrink-0">
                            <button onClick={confirmOpen} aria-label="Open QR Code URL" className="theme-accent-orange flex h-6 w-6 items-center justify-center rounded-full transition-colors active:scale-95"><ExternalLink className="h-3 w-3" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* QR Code — edit mode (opens settings dialog, no slide) */}
                {isEditMode && (
                  <button
                    onClick={() => { setQrDecodeStatus("idle"); setShowQRDialog(true) }}
                    className="group flex w-full items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-2.5 py-1.5 transition-all hover:bg-muted/45 active:scale-[0.98]"
                  >
                    <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                      <QrCode className="h-3.5 w-3.5 text-orange-500" />
                      <span className="absolute -top-1 -right-1 bg-background rounded-full p-0.5 shadow-sm border border-border/40">
                        {qrCodeImageUrl ? <Pencil className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                      </span>
                    </div>
                    <span className="flex-1 text-left text-[11px] font-semibold text-foreground">
                      {qrCodeImageUrl ? "Edit QR Code" : "Add QR Code"}
                    </span>
                    <ChevronRight className="size-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
                  </button>
                )}

              </div>
            </div>
          )}

          {/* Avatar Gallery Dialog */}
          {showAvatarDialog && (
          <Dialog open={showAvatarDialog} onOpenChange={(o) => { if (!o) { setAvatarTab("url"); setAvatarUrlInput("") } setShowAvatarDialog(o) }}>
            <DialogContent className="w-[92vw] max-w-sm rounded-2xl p-0 overflow-hidden gap-0">

              {/* Header */}
              <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Camera className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold leading-tight">Avatar Media</DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Manage images and videos for this location.</p>
                  </div>
                </div>
              </DialogHeader>

              {/* Body */}
              <div className="overflow-y-auto max-h-[60vh] px-5 py-4 space-y-4">

                {/* Image grid */}
                {dialogImages.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                      Media <span className="text-muted-foreground/60 font-normal">({dialogImages.length}/{MAX_AVATAR_MEDIA_ITEMS}) · tap to select</span>
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {dialogImages.map((url, i) => (
                        <div key={i} className="relative group">
                          <button
                            onClick={() => setDialogSelected(url)}
                            className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                              dialogSelected === url
                                ? "border-primary ring-2 ring-primary/30"
                                : "border-transparent hover:border-primary/40"
                            }`}
                          >
                            {isVideoMediaUrl(url) ? (
                              <div className="relative h-full w-full bg-muted/50">
                                <img
                                  src={getVideoPoster(url)}
                                  alt={`avatar-video-${i}`}
                                  className="h-full w-full object-cover"
                                  onError={(event) => { event.currentTarget.src = fallbackNoImageSrc }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                                  <Play className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            ) : (
                              <img src={url} alt={`avatar-${i}`} className="h-full w-full bg-muted/40 object-contain" />
                            )}
                          </button>
                          {dialogSelected === url && (
                            <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5 pointer-events-none shadow">
                              <Check className="w-2.5 h-2.5 text-primary-foreground" />
                            </div>
                          )}
                          <button
                            onClick={() => {
                              const next = dialogImages.filter((_, idx) => idx !== i)
                              setDialogImages(next)
                              if (dialogSelected === url) setDialogSelected(next[0] ?? "")
                            }}
                            className="absolute -bottom-1 -right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                      <Camera className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No media yet</p>
                    <p className="text-xs text-muted-foreground/60">Add one below.</p>
                  </div>
                )}

                {/* Add new media */}
                {dialogImages.length < MAX_AVATAR_MEDIA_ITEMS && (
                  <div className="border-t border-border pt-4 space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Add Media</p>

                    {/* Tabs */}
                    <div className="flex rounded-xl border border-border overflow-hidden bg-muted/40 p-0.5 gap-0.5">
                      {(["url", "upload-image", "upload-video"] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setAvatarTab(tab)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                            avatarTab === tab
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {tab === "url" && <><Link2 className="w-3 h-3" />URL</>}
                          {tab === "upload-image" && <><ImageUp className="w-3 h-3" />Image</>}
                          {tab === "upload-video" && <><Video className="w-3 h-3" />Video</>}
                        </button>
                      ))}
                    </div>

                    {avatarTab === "url" && (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Image / Video URL</label>
                        <div className="flex gap-2">
                          <Input
                            value={avatarUrlInput}
                            onChange={e => setAvatarUrlInput(e.target.value)}
                            placeholder="https://example.com/image.jpg or YouTube/Vimeo URL"
                            className="h-9 text-[11px] md:text-[11px] flex-1"
                          />
                          <Button
                            size="sm"
                            className="h-9 shrink-0"
                            disabled={!avatarUrlInput.trim() || dialogImages.length >= MAX_AVATAR_MEDIA_ITEMS}
                            onClick={async () => {
                              const url = avatarUrlInput.trim()
                              if (!url) return
                              try {
                                const validation = await validateMediaUrl(url)
                                const next = [...dialogImages, url].slice(0, MAX_AVATAR_MEDIA_ITEMS)
                                setDialogImages(next)
                                if (!dialogSelected) setDialogSelected(url)
                                setAvatarUrlInput("")
                                toast.success(validation.kind === "video" ? "Video link ditambah" : "Image link ditambah", {
                                  description: "URL berjaya disahkan.",
                                  icon: <CheckCircle2 className="size-4 text-primary" />,
                                  duration: 2500,
                                })
                              } catch (error) {
                                toast.error("URL tak sah", {
                                  description: error instanceof Error ? error.message : "Sila semak semula link tersebut.",
                                  icon: <AlertCircle className="size-4" />,
                                  duration: 4500,
                                })
                              }
                            }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {avatarTab === "upload-image" && (
                      <>
                        <div
                          onClick={() => !avatarUploading && avatarFileRef.current?.click()}
                          className={`flex flex-col items-center justify-center gap-2.5 border-2 border-dashed rounded-2xl py-6 cursor-pointer transition-colors ${
                            avatarUploading ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"
                          }`}
                        >
                          {avatarUploading ? (
                            <>
                              <LoadingSpinner size={24} className="text-primary" />
                              <p className="text-xs font-medium text-primary">Uploading…</p>
                            </>
                          ) : (
                            <>
                              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                                <ImageUp className="w-5 h-5 text-muted-foreground" />
                              </div>
                              <div className="text-center">
                                <p className="text-xs font-semibold text-foreground">Click to upload</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">PNG, JPG, etc. — multiple allowed</p>
                              </div>
                            </>
                          )}
                        </div>
                        <input
                          ref={avatarFileRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={async e => {
                            const files = Array.from(e.target.files ?? [])
                            if (!files.length) return
                            setAvatarUploading(true)
                            const uploadToastId = toast.loading(
                              `Uploading ${files.length} image${files.length > 1 ? "s" : ""}…`,
                              { duration: Infinity }
                            )
                            try {
                              const urls: string[] = []
                              for (const file of files) {
                                const url = await uploadImageToImgBB(file)
                                urls.push(url)
                              }
                              toast.dismiss(uploadToastId)
                              toast.success("Upload berjaya", {
                                description: `${urls.length} imej dimuat naik.`,
                                icon: <CheckCircle2 className="size-4 text-primary" />,
                                duration: 3000,
                              })
                              const next = [...dialogImages, ...urls].slice(0, MAX_AVATAR_MEDIA_ITEMS)
                              setDialogImages(next)
                              if (!dialogSelected && next.length > 0) setDialogSelected(next[0])
                            } catch {
                              toast.dismiss(uploadToastId)
                              toast.error("Upload gagal", {
                                description: "Sila cuba semula.",
                                icon: <AlertCircle className="size-4" />,
                                duration: 4000,
                              })
                            } finally {
                              setAvatarUploading(false)
                              if (avatarFileRef.current) avatarFileRef.current.value = ""
                            }
                          }}
                        />
                      </>
                    )}

                    {avatarTab === "upload-video" && (
                      <>
                        <div
                          onClick={() => !avatarVideoUploading && avatarVideoFileRef.current?.click()}
                          className={`flex flex-col items-center justify-center gap-2.5 border-2 border-dashed rounded-2xl py-6 cursor-pointer transition-colors ${
                            avatarVideoUploading ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"
                          }`}
                        >
                          {avatarVideoUploading ? (
                            <>
                              <LoadingSpinner size={24} className="text-primary" />
                              <p className="text-xs font-medium text-primary">Processing video…</p>
                            </>
                          ) : (
                            <>
                              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                                <Video className="w-5 h-5 text-muted-foreground" />
                              </div>
                              <div className="text-center">
                                <p className="text-xs font-semibold text-foreground">Click to upload video</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">MP4, WEBM, OGG, MOV</p>
                              </div>
                            </>
                          )}
                        </div>
                        <input
                          ref={avatarVideoFileRef}
                          type="file"
                          accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-m4v"
                          multiple
                          className="hidden"
                          onChange={async e => {
                            const files = Array.from(e.target.files ?? [])
                            if (!files.length) return
                            setAvatarVideoUploading(true)
                            try {
                              const urls: string[] = []
                              for (const file of files) {
                                urls.push(await createVideoDataUrl(file))
                              }

                              const next = [...dialogImages, ...urls].slice(0, MAX_AVATAR_MEDIA_ITEMS)
                              setDialogImages(next)
                              if (!dialogSelected && next.length > 0) setDialogSelected(next[0])

                              toast.success("Video ditambah", {
                                description: `${urls.length} video dimuat naik ke sesi ini.`,
                                icon: <CheckCircle2 className="size-4 text-primary" />,
                                duration: 3000,
                              })
                            } catch {
                              toast.error("Upload video gagal", {
                                description: "Sila cuba semula.",
                                icon: <AlertCircle className="size-4" />,
                                duration: 4000,
                              })
                            } finally {
                              setAvatarVideoUploading(false)
                              if (avatarVideoFileRef.current) avatarVideoFileRef.current.value = ""
                            }
                          }}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-border flex gap-2 justify-end bg-muted/20">
                <Button variant="outline" size="sm" onClick={() => setShowAvatarDialog(false)}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const newImages = dialogImages
                    const newSelectedUrl = dialogSelected || dialogImages[0] || ""
                    setAvatarImages(newImages)
                    setAvatarImageUrl(newSelectedUrl)
                    setShowAvatarDialog(false)
                    const updatedPoint = {
                      ...point,
                      descriptions: drafts.filter(d => d.key.trim() !== ""),
                      qrCodeImageUrl,
                      qrCodeDestinationUrl,
                      avatarImageUrl: newSelectedUrl,
                      avatarImages: newImages
                    }
                    onSave?.(updatedPoint)
                    toast.success("Avatar updated", {
                      description: `${point.name || point.code} images saved.`,
                      icon: <CheckCircle2 className="size-4 text-primary" />,
                      duration: 3000,
                    })
                  }}
                >
                  <Check className="w-3.5 h-3.5 mr-1" />Save
                </Button>
              </div>

            </DialogContent>
          </Dialog>
          )}

          {/* QR Code dialog — unified for view + edit mode */}
          {showQRDialog && (
          <Dialog open={showQRDialog} onOpenChange={(o) => { if (!o) { setQrTab("url"); setQrDecodeStatus("idle") } setShowQRDialog(o) }}>
            <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden gap-0">

              {/* Header */}
              <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <QrCode className="theme-accent-orange w-5 h-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold leading-tight">
                      {isEditMode ? "QR Code Settings" : "QR Code"}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isEditMode ? "Manage the QR code for this location." : "View or open the QR code destination."}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              {/* Body */}
              <div className="px-5 py-4 space-y-4">

                {/* ── EDIT MODE ── */}
                {isEditMode && (
                  <>
                    {/* Preview */}
                    {qrCodeImageUrl && (
                      <div className="relative flex justify-center p-3 bg-muted/40 rounded-2xl border border-border">
                        <img src={qrCodeImageUrl} alt="QR Code"
                          className="h-40 w-40 rounded-lg bg-background object-contain shadow-sm"
                        />
                        <button
                          onClick={() => { setQrCodeImageUrl(""); setQrDecodeStatus("idle"); if (fileInputRef.current) fileInputRef.current.value = "" }}
                          className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1 hover:bg-destructive/80 transition-colors shadow"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Tabs */}
                    <div className="flex rounded-xl border border-border overflow-hidden bg-muted/40 p-0.5 gap-0.5">
                      {(["url", "media"] as const).map(tab => (
                        <button key={tab}
                          onClick={() => { setQrTab(tab); setQrDecodeStatus("idle") }}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                            qrTab === tab
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {tab === "url" ? <><Link2 className="w-3 h-3" />URL</> : <><ImageUp className="w-3 h-3" />Upload</>}
                        </button>
                      ))}
                    </div>

                    {/* Tab: URL */}
                    {qrTab === "url" && (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">QR Image URL</label>
                        <Input value={qrCodeImageUrl} onChange={e => setQrCodeImageUrl(e.target.value)}
                          placeholder="https://example.com/qr.png" className="h-9 text-[11px] md:text-[11px]" />
                      </div>
                    )}

                    {/* Tab: Upload → ImgBB */}
                    {qrTab === "media" && (
                      <div className="space-y-2.5">
                        <div
                          onClick={() => !isUploadingQR && fileInputRef.current?.click()}
                          className={`flex flex-col items-center justify-center gap-2.5 border-2 border-dashed rounded-2xl py-6 cursor-pointer transition-colors ${
                            isUploadingQR ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"
                          }`}
                        >
                          {isUploadingQR ? (
                            <>
                              <LoadingSpinner size={24} className="text-primary" />
                              <p className="text-xs font-medium text-primary">Uploading to cloud…</p>
                            </>
                          ) : (
                            <>
                              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                                <ImageUp className="w-5 h-5 text-muted-foreground" />
                              </div>
                              <div className="text-center">
                                <p className="text-xs font-semibold text-foreground">Click to upload</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Auto-scan included · PNG, JPG, etc.</p>
                              </div>
                            </>
                          )}
                        </div>
                        {qrDecodeStatus === "decoding" && (
                          <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                            <LoadingSpinner size={14} className="text-primary" />Scanning QR code…
                          </div>
                        )}
                        {qrDecodeStatus === "decoded" && (
                          <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--accent-emerald)/0.12)] px-3 py-2 text-xs text-[hsl(var(--accent-emerald))]">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />QR decoded — destination URL auto-filled.
                          </div>
                        )}
                        {qrDecodeStatus === "failed" && (
                          <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--accent-amber)/0.14)] px-3 py-2 text-xs text-[hsl(var(--accent-amber))]">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />QR code could not be read. Please enter the destination URL manually.
                          </div>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleQrFileUpload} />
                      </div>
                    )}

                    {/* Destination URL */}
                    <div className="pt-1 border-t border-border space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Destination URL</label>
                        {qrDecodeStatus === "decoded" && (
                          <span className="rounded-md bg-[hsl(var(--accent-emerald)/0.12)] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--accent-emerald))]">Auto-filled ✓</span>
                        )}
                      </div>
                      <Input value={qrCodeDestinationUrl} onChange={e => setQrCodeDestinationUrl(e.target.value)}
                        placeholder="https://example.com/destination" className="h-9 text-[11px] md:text-[11px]" />
                    </div>
                  </>
                )}

                {/* ── VIEW MODE ── */}
                {!isEditMode && (
                  <div className="space-y-3">
                    {qrCodeImageUrl && (
                      <div className="flex justify-center p-3 bg-muted/40 rounded-2xl border border-border">
                        <img src={qrCodeImageUrl} alt="QR Code"
                          className="h-44 w-44 rounded-lg bg-background object-contain shadow-sm"
                        />
                      </div>
                    )}
                    {qrCodeDestinationUrl ? (
                      <div className="bg-muted/50 rounded-xl border border-border px-4 py-3 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Destination URL</p>
                        <p className="text-xs font-mono break-all text-foreground leading-relaxed">{qrCodeDestinationUrl}</p>
                      </div>
                    ) : !qrCodeImageUrl && (
                      <div className="flex flex-col items-center gap-2 py-6 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                          <QrCode className="w-6 h-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No QR code configured</p>
                        <p className="text-xs text-muted-foreground/60">Enable edit mode to add one.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-border flex gap-2 justify-end bg-muted/20">
                {isEditMode ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowQRDialog(false)}>Cancel</Button>
                    <Button size="sm" onClick={() => { handleSave(); setShowQRDialog(false) }}>Save</Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowQRDialog(false)}>Close</Button>
                    {qrCodeDestinationUrl && (
                      <Button size="sm" onClick={() => { window.open(qrCodeDestinationUrl, "_blank"); setShowQRDialog(false) }}>
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Open Link
                      </Button>
                    )}
                  </>
                )}
              </div>

            </DialogContent>
          </Dialog>
          )}

          {/* QR Scan result modal removed — integrated into main QR dialog */}
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-muted/15 px-4 py-3 sm:space-x-0">
          {isEditMode ? (
            isEditing ? (
              <div className="flex w-full items-center justify-between">
                <button
                  onClick={handleCancel}
                  className="theme-danger text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                {hasChanges && (
                  <button
                    onClick={handleSave}
                    className="theme-accent-emerald text-xs font-semibold transition-opacity hover:opacity-80"
                  >
                    Save
                  </button>
                )}
              </div>
            ) : (
              <button
                className="theme-danger ml-auto text-xs font-medium transition-colors"
                onClick={() => onOpenChange(false)}
              >
                Close
              </button>
            )
          ) : (
            <div className="flex w-full items-center justify-end">
              <button
                className="theme-danger text-xs font-medium transition-colors"
                onClick={() => onOpenChange(false)}
              >
                Close
              </button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <div ref={avatarGalleryHostRef} className="hidden" />
    </>
  )
}
