import { Terminal, MessageCircle } from "lucide-react"

const COMMAND_ITEMS = [
  {
    label: ".help",
    description: "Show available bot commands.",
  },
  {
    label: ".routes",
    description: "List available routes from the Routebot API.",
  },
  {
    label: ".ping",
    description: "Quick latency check for bot response.",
  },
  {
    label: ".zip teks contoh",
    description: "Compress text into gzip+base64 for quick sharing.",
  },
]

export function BotCommand() {
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 p-4 md:p-6">
      <div className="rounded-2xl border border-border/70 bg-card p-4 md:p-5">
        <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
          <Terminal className="size-5 text-sky-600" />
          Bot Command
        </h1>
        <p className="mt-1 text-xs md:text-sm text-muted-foreground">
          Quick reference for WhatsApp bot commands used by operators.
        </p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-4 md:p-5 space-y-3">
        {COMMAND_ITEMS.map((command) => (
          <div key={command.label} className="rounded-xl border border-border bg-background px-3 py-2.5">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MessageCircle className="size-3.5 text-emerald-500" />
              {command.label}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{command.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
