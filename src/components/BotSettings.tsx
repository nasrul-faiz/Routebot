import { Cog, ShieldCheck, Link2 } from "lucide-react"

export function BotSettings() {
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 p-4 md:p-6">
      <div className="rounded-2xl border border-border/70 bg-card p-4 md:p-5">
        <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
          <Cog className="size-5 text-amber-500" />
          Bot Settings
        </h1>
        <p className="mt-1 text-xs md:text-sm text-muted-foreground">
          Manage WhatsApp bot configuration and security guidance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/70 bg-card p-4 md:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Connection</p>
          <p className="mt-2 text-sm font-semibold flex items-center gap-2">
            <Link2 className="size-4 text-sky-500" />
            Base URL and token
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ensure APP_BASE_URL, dashboard token, and BOT_PAIRING_METHOD are valid before pairing devices.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 md:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Security</p>
          <p className="mt-2 text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-500" />
            Session persistence
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Keep AUTH_DIR persisted and rotate tokens when moving environments.
          </p>
        </div>
      </div>
    </div>
  )
}
