import * as React from "react"
import {
  CalendarDays, CheckIcon, ChevronsUpDown, Cog, House, Images,
  Moon, Package, Pencil, Sun, Users, MapPin, MessageCircle,
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

const workspaces = [
  {
    id: "home",
    name: "Home",
    description: "Dashboard & quick access",
    initial: "H",
    color: "bg-indigo-600",
    page: "home",
  },
  {
    id: "operations",
    name: "Operations",
    description: "Routes & deliveries",
    initial: "O",
    color: "bg-emerald-600",
    page: "route-list",
  },
  {
    id: "gallery",
    name: "Gallery",
    description: "Plano VM & site images",
    initial: "G",
    color: "bg-pink-600",
    page: "plano-vm",
  },
]

const navItems = [
  { title: "Home",        icon: House,        page: "home",                iconColor: "text-indigo-500" },
  { title: "Route List",  icon: Package,      page: "route-list",          iconColor: "text-emerald-500" },
  { title: "Location",    icon: CalendarDays, page: "deliveries",          iconColor: "text-sky-500" },
  { title: "Rooster",     icon: Users,        page: "rooster",             iconColor: "text-orange-500" },
  { title: "Plano VM",    icon: Images,       page: "plano-vm",            iconColor: "text-pink-500" },
  { title: "Site Images", icon: MapPin,       page: "gallery-site-images", iconColor: "text-rose-500" },
  { title: "Bot Dashboard", icon: MessageCircle, page: "bot-dashboard", iconColor: "text-green-600" },
]

const settingsItems = [
  { title: "Settings", icon: Cog, page: "settings", iconColor: "text-amber-500" },
]

function getActiveWorkspace(currentPage: string | undefined) {
  if (!currentPage) return workspaces[0]
  if (currentPage === "home") return workspaces[0]
  if (["route-list", "deliveries", "custom", "rooster", "bot-dashboard"].includes(currentPage)) return workspaces[1]
  if (["plano-vm", "gallery-album", "gallery-site-images"].includes(currentPage)) return workspaces[2]
  return workspaces[0]
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

  const activeWorkspace = getActiveWorkspace(currentPage)

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
                      className={`flex h-8 w-8 items-center justify-center rounded-md ${activeWorkspace.color} text-white text-sm font-bold shrink-0`}
                    >
                      {activeWorkspace.initial}
                    </div>
                    <div className="flex flex-col leading-tight min-w-0">
                      <span className="font-semibold text-sm truncate">{activeWorkspace.name}</span>
                      <span className="text-xs text-muted-foreground truncate">{activeWorkspace.description}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 text-muted-foreground shrink-0" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)]"
                  align="start"
                >
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Workspaces
                  </DropdownMenuLabel>
                  {workspaces.map((ws) => {
                    const isActive = ws.id === activeWorkspace.id
                    return (
                      <DropdownMenuItem
                        key={ws.id}
                        className="gap-2"
                        onSelect={() => navigate(ws.page)}
                      >
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded ${ws.color} text-white text-xs font-bold shrink-0`}
                        >
                          {ws.initial}
                        </div>
                        <div className="flex flex-col leading-tight">
                          <span className="text-sm">{ws.name}</span>
                          <span className="text-xs text-muted-foreground">{ws.description}</span>
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
                      Switch between workspaces to manage routes, gallery and more.
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
                {navItems.map((item) => (
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
