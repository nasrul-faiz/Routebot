import { Type, Palette, Database, Lock, ChevronRight, Cog, User, Bell } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { useEditMode } from "@/contexts/EditModeContext"

type SettingsItem = {
  icon: React.ReactNode
  title: string
  description: string
  page: string
  accentClass: string
}

const SETTINGS_ITEMS: SettingsItem[] = [
  {
    icon: <Type className="size-5" />,
    title: "Font",
    description: "Standardize app typography and readability.",
    page: "settings-appearance-font",
    accentClass: "text-violet-400 bg-violet-400/10",
  },
  {
    icon: <Palette className="size-5" />,
    title: "Route Colours",
    description: "Choose a polished palette for route cards.",
    page: "settings-route-colors",
    accentClass: "text-pink-400 bg-pink-400/10",
  },
  {
    icon: <Database className="size-5" />,
    title: "Storage",
    description: "View where your data is stored and managed.",
    page: "settings-storage",
    accentClass: "text-sky-400 bg-sky-400/10",
  },
  {
    icon: <Lock className="size-5" />,
    title: "Security",
    description: "Keep access and passwords secure.",
    page: "settings-security",
    accentClass: "text-emerald-400 bg-emerald-400/10",
  },
]

const USER_ITEMS = [
  { icon: <User className="size-5" />, title: "Profile", page: "settings-profile", accentClass: "text-blue-400 bg-blue-400/10" },
  { icon: <Bell className="size-5" />, title: "Notifications", page: "settings-notifications", accentClass: "text-orange-400 bg-orange-400/10" },
]

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("")
}

function SettingRow({ icon, title, description, accentClass, onClick }: {
  icon: React.ReactNode; title: string; description?: string; accentClass: string; onClick: () => void
}) {
  const iconClass = accentClass.replace(/\bbg-[^\s]+\b/g, "").trim()

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 w-full rounded-3xl bg-transparent border-0 px-4 py-4 text-left transition hover:shadow-md"
    >
      <span className={`size-10 grid place-items-center rounded-2xl ${iconClass}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight truncate">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-1 leading-snug truncate">{description}</p>}
      </div>
      <ChevronRight className="size-4 text-muted-foreground/70 shrink-0" />
    </button>
  )
}

export function SettingsHub({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { isEditMode } = useEditMode()
  const user = { name: "User", email: "user@example.com", avatar: "/avatars/user.jpg" }
  const initials = getInitials(user.name)

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-6xl mx-auto w-full">
      <PageHeader
        icon={<Cog className="size-3.5" />}
        title="Settings"
        description="Configure your workspace preferences with a clean and professional settings dashboard."
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="grid h-16 w-16 place-items-center rounded-3xl bg-slate-950/5 text-slate-700 ring-1 ring-slate-900/10">
                <span className="text-xl font-semibold">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-lg font-semibold text-foreground">{user.name}</p>
                <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
                <p className="text-sm text-slate-600 mt-4 max-w-2xl">This dashboard groups all settings into concise, easy-to-scan cards. Open a section to update profile, notifications, appearance, storage, and security settings.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {USER_ITEMS.map((item) => (
                <button
                  key={item.page}
                  type="button"
                  onClick={() => onNavigate(item.page)}
                  className="flex items-center gap-3 rounded-2xl bg-transparent border-0 px-4 py-4 text-left transition hover:bg-muted/20"
                >
                  <span className={`size-10 grid place-items-center rounded-2xl ${item.accentClass.replace(/\bbg-[^\s]+\b/g, "").trim()}`}>
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">Open {item.title.toLowerCase()}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground mb-5">App preferences</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {SETTINGS_ITEMS.map((item) => (
                <SettingRow key={item.page} icon={item.icon} title={item.title} description={item.description} accentClass={item.accentClass} onClick={() => onNavigate(item.page)} />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <div className={`rounded-3xl border border-border p-6 bg-card text-foreground shadow-sm ${isEditMode ? 'shadow-lg' : ''}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground mb-4">Quick status</p>
            <div className="space-y-3">
              <div className={`rounded-3xl border border-border/70 p-4 bg-background ${isEditMode ? 'shadow-sm' : ''}`}>
                <p className="text-sm font-semibold">Edit Mode</p>
                <p className="text-xs mt-1 text-muted-foreground">Enable edit mode to make changes and save them intentionally.</p>
              </div>
              <div className={`rounded-3xl border border-border/70 p-4 bg-background ${isEditMode ? 'shadow-sm' : ''}`}>
                <p className="text-sm font-semibold">Storage Overview</p>
                <p className="text-xs mt-1 text-muted-foreground">Database entries and local storage items are tracked for reliable data management.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground mb-4">Pro tip</p>
            <p className="text-sm leading-relaxed text-slate-600">Use the Font section to align your app's visual tone, then review route colours and security settings for a streamlined professional experience.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
