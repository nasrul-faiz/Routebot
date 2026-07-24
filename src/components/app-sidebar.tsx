import * as React from "react"
import {
  CalendarDays, CheckIcon, ChevronsUpDown, Cog, House, Images,
  Moon, Package, Pencil, Sun, Users, MapPin, MessageCircle, Globe, Terminal,
} from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading"
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useEditMode } from "@/contexts/EditModeContext"
import { useTheme } from "@/hooks/use-theme"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const dropdownOptions = [
  {
    id: "web",
    name: "Web",
    description: "Main web experience",
    initial: "W",
    color: "bg-sky-600",
    page: "home",
    icon: Globe,
    iconColor: "text-sky-500",
  },
  {
    id: "bot-whatsapp",
    name: "Bot WhatsApp",
    description: "WhatsApp bot controls",
    initial: "B",
    color: "bg-emerald-600",
    page: "bot-dashboard",
    icon: MessageCircle,
    iconColor: "text-emerald-500",
  },
]

const webNavItems = [
  { title: "Home",        icon: House,        page: "home",                iconColor: "text-indigo-500" },
  { title: "Route List",  icon: Package,      page: "route-list",          iconColor: "text-emerald-500" },
  { title: "Location",    icon: CalendarDays, page: "deliveries",          iconColor: "text-sky-500" },
  { title: "Rooster",     icon: Users,        page: "rooster",             iconColor: "text-orange-500" },
  { title: "Plano VM",    icon: Images,       page: "plano-vm",            iconColor: "text-pink-500" },
  { title: "Site Images", icon: MapPin,       page: "gallery-site-images", iconColor: "text-rose-500" },
]

const botNavItems = [
  { title: "Bot Dashboard", icon: MessageCircle, page: "bot-dashboard", iconColor: "text-green-600" },
  { title: "Command", icon: Terminal, page: "bot-command", iconColor: "text-sky-500" },
  { title: "Bot Settings", icon: Cog, page: "bot-settings", iconColor: "text-amber-500" },
]

const settingsItems = [
  { title: "Settings", icon: Cog, page: "settings", iconColor: "text-amber-500" },
]

function getActiveDropdownOption(currentPage: string | undefined) {
  if (!currentPage) return dropdownOptions[0]
  if (["bot-dashboard", "bot-command", "bot-settings"].includes(currentPage)) return dropdownOptions[1]
  return dropdownOptions[0]
}

export function AppSidebar({
  onNavigate,
  currentPage,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  onNavigate?: (page: string) => void
  currentPage?: string
}) {
  const { setOpenMobile } = useSidebar()
  const { isEditMode, setIsEditMode, hasUnsavedChanges, saveChanges, isSaving, discardChanges } = useEditMode()
  const { mode, toggleMode } = useTheme()
  const isDark = mode === "dark"
  const [unsavedDialogOpen, setUnsavedDialogOpen] = React.useState(false)
  const [isEditModeTransitioning, setIsEditModeTransitioning] = React.useState(false)

  const navigate = React.useCallback(
    (page: string) => { onNavigate?.(page); setOpenMobile(false) },
    [onNavigate, setOpenMobile]
  )

  const applyEditModeChange = (next: boolean) => {
    setIsEditModeTransitioning(true)
    window.setTimeout(() => { setIsEditMode(next); setIsEditModeTransitioning(false) }, 260)
  }

  const handleEditModeToggle = () => {
    if (isEditModeTransitioning) return
    if (isEditMode && hasUnsavedChanges) setUnsavedDialogOpen(true)
    else applyEditModeChange(!isEditMode)
  }

  const activeDropdownOption = getActiveDropdownOption(currentPage)
  const isBotWhatsappView = activeDropdownOption.id === "bot-whatsapp"
  const visibleNavItems = isBotWhatsappView ? botNavItems : webNavItems

  return (
    <>
      <Sidebar {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-md ${activeDropdownOption.color} text-white text-sm font-bold shrink-0`}
                    >
                      {activeDropdownOption.initial}
                    </div>
                    <div className="flex flex-col leading-tight min-w-0">
                      <span className="font-semibold text-sm truncate">{activeDropdownOption.name}</span>
                      <span className="text-xs text-muted-foreground truncate">{activeDropdownOption.description}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 text-muted-foreground shrink-0" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)]"
                  align="start"
                >
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Select View
                  </DropdownMenuLabel>
                  {dropdownOptions.map((item) => {
                    const isActive = item.id === activeDropdownOption.id
                    return (
                      <DropdownMenuItem
                        key={item.id}
                        className="gap-2"
                        onSelect={() => navigate(item.page)}
                      >
                        <item.icon className={`size-4 shrink-0 ${item.iconColor}`} />
                        <div className="flex flex-col leading-tight">
                          <span className="text-sm">{item.name}</span>
                          <span className="text-xs text-muted-foreground">{item.description}</span>
                        </div>
                        {isActive && (
                          <CheckIcon className="ml-auto size-4 shrink-0" />
                        )}
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2"
                    disabled={isEditModeTransitioning}
                    onSelect={handleEditModeToggle}
                  >
                    {isEditModeTransitioning
                      ? <LoadingSpinner size={14} className="shrink-0" />
                      : <Pencil className={`size-4 shrink-0 ${isEditMode ? "text-emerald-500" : "text-muted-foreground"}`} />}
                    <span className="text-sm">
                      {isEditModeTransitioning ? "Switching..." : isEditMode ? "Turn Off Edit Mode" : "Turn On Edit Mode"}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5">
                    <p className="text-[11px] text-muted-foreground">
                      Switch quickly between Web and Bot WhatsApp.
                    </p>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={currentPage === item.page}
                      onClick={() => navigate(item.page)}
                    >
                      <item.icon className={`size-4 ${item.iconColor}`} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {!isBotWhatsappView && (
            <SidebarGroup>
              <SidebarGroupLabel>General</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {settingsItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={currentPage?.startsWith("settings") ?? false}
                        onClick={() => navigate(item.page)}
                      >
                        <item.icon className={`size-4 ${item.iconColor}`} />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={toggleMode}>
                {isDark
                  ? <Moon className="size-4 text-indigo-400" />
                  : <Sun className="size-4 text-amber-500" />}
                <span>{isDark ? "Dark Mode" : "Light Mode"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          <p className="text-center text-[10px] font-semibold text-muted-foreground/90 pb-1 pt-1">
            Dbrutals v1.0.0
          </p>
        </SidebarFooter>
      </Sidebar>

      <Dialog open={unsavedDialogOpen} onOpenChange={setUnsavedDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. What would you like to do before turning off Edit Mode?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { discardChanges(); setUnsavedDialogOpen(false); setIsEditMode(false) }}>
              Discard Changes
            </Button>
            <Button onClick={async () => { await saveChanges(); setUnsavedDialogOpen(false); setIsEditMode(false) }} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save & Turn Off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
