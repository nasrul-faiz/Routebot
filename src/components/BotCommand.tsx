import { Terminal, MessageCircle, Sparkles } from "lucide-react"

const COMMAND_ITEMS = [
  {
    label: ".help",
    description: "Tunjuk senarai semua command yang ada.",
  },
  {
    label: ".ping",
    description: "Semak sama ada bot masih aktif.",
  },
  {
    label: ".routes",
    description: "Senarai semua route yang tersedia.",
  },
  {
    label: ".route <code|name>",
    description: "Paparkan maklumat route tertentu.",
  },
  {
    label: ".today",
    description: "Ringkasan stop aktif untuk hari ini.",
  },
  {
    label: ".tts <text>",
    description: "Hantar voice note yang dijana daripada teks.",
  },
  {
    label: ".vv",
    description: "Hantar semula media view-once yang diterima sebagai gambar atau video.",
  },
  {
    label: ".qr <text>",
    description: "Hasilkan QR code PNG berkualiti tinggi dari teks atau URL.",
  },
  {
    label: ".txt <text>",
    description: "Hasilkan fail teks .txt dari teks yang diberikan.",
  },
  {
    label: ".pdf <text>",
    description: "Hasilkan fail PDF dari teks yang diberikan.",
  },
  {
    label: ".sticker",
    description: "Reply gambar atau video untuk dijadikan sticker.",
  },
  {
    label: ".sticker nobg",
    description: "Reply gambar untuk dijadikan sticker tanpa background.",
  },
  {
    label: ".zip <text>",
    description: "Mampat teks ke gzip+base64 atau reply media untuk dapat fail .zip.",
  },
  {
    label: ".unzip <base64>",
    description: "Nyahmampat data gzip+base64 atau media yang direply kembali ke teks.",
  },
  {
    label: ".33 atau <location_code>",
    description: "Command pantas untuk melihat detail lokasi menggunakan kod lokasi.",
  },
]

export function BotCommand() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-auto bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6 lg:p-8">
        <div className="rounded-3xl border border-border/70 bg-card/95 p-4 shadow-sm md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Terminal className="size-5 text-sky-600" />
                Bot Command List
              </h1>
              <p className="mt-1 text-xs md:text-sm text-muted-foreground">
                Senarai command WhatsApp bot yang boleh digunakan oleh operator.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                Ready
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {COMMAND_ITEMS.map((command) => (
            <div key={command.label} className="rounded-2xl border border-border/70 bg-background/80 p-3 shadow-sm backdrop-blur-sm">
              <div className="flex items-start gap-2">
                <MessageCircle className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground break-all">{command.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{command.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
