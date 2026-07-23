import { useState } from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
  onItemClick,
  onSubItemClick,
  searchQuery = "",
  currentPage,
  openItem: controlledOpenItem,
  onOpenItemChange,
  label,
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon
    color?: string
    page?: string
    isActive?: boolean
    items?: {
      title: string
      url: string
      page?: string
    }[]
  }[]
  onItemClick?: (title: string) => void
  onSubItemClick?: (page: string) => void
  searchQuery?: string
  currentPage?: string
  openItem?: string | null
  onOpenItemChange?: (item: string | null) => void
  label?: string
}) {
  const initialOpen = items.find((i) => i.isActive && i.items?.length)?.title ?? null
  const [localOpenItem, setLocalOpenItem] = useState<string | null>(initialOpen)

  const isControlled = controlledOpenItem !== undefined
  const openItem = isControlled ? controlledOpenItem : localOpenItem
  const setOpenItem = (val: string | null) => {
    if (isControlled) onOpenItemChange?.(val)
    else setLocalOpenItem(val)
  }

  const isSearching = searchQuery.trim().length > 0

  const handleToggle = (title: string, hasChildren: boolean, page?: string) => {
    if (!hasChildren) {
      if (page) onSubItemClick?.(page)
      else onItemClick?.(title)
      return
    }
    setOpenItem(openItem === title ? null : title)
    onItemClick?.(title)
  }

  return (
    <SidebarGroup className="py-0">
      {label && <SidebarGroupLabel className="text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/50 px-1 mb-0.5">{label}</SidebarGroupLabel>}
      <SidebarMenu className="gap-0.5">
        {isSearching && items.length === 0 ? null : (
        items.map((item) => {
          const hasChildren = !!item.items?.length
          const isOpen = isSearching ? true : openItem === item.title
          const sectionColor = item.color ?? "hsl(var(--sidebar-primary))"

          return (
            <Collapsible
              key={item.title}
              asChild
              open={hasChildren ? isOpen : undefined}
              onOpenChange={hasChildren ? (open) => { if (!isSearching) setOpenItem(open ? item.title : null) } : undefined}
            >
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={item.title}
                  className="transition-all duration-150 rounded-lg"
                  onClick={() => handleToggle(item.title, hasChildren, item.page)}
                >
                  <item.icon
                    className="size-[14px] shrink-0 transition-colors"
                    style={{ color: sectionColor }}
                  />
                  <span className="text-[11px] font-medium text-foreground leading-tight">{item.title}</span>
                </SidebarMenuButton>

                {hasChildren ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction
                        className="transition-transform duration-300 data-[state=open]:rotate-90"
                        style={isOpen ? { color: sectionColor } : {}}
                      >
                        <ChevronRight className="size-3.5" />
                        <span className="sr-only">Toggle</span>
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <div
                      aria-hidden={!isOpen}
                      style={{
                        display: "grid",
                        gridTemplateRows: isOpen ? "1fr" : "0fr",
                        transition: "grid-template-rows 0.28s cubic-bezier(0.25,0.1,0.25,1), opacity 0.28s cubic-bezier(0.25,0.1,0.25,1)",
                        opacity: isOpen ? 1 : 0,
                      }}
                    >
                      <div className="overflow-hidden">
                        <SidebarMenuSub
                          className={`ml-3 border-l-0 transition-all duration-300 ${!isOpen ? "pointer-events-none" : ""}`}
                          style={{
                            borderLeft: `2px solid color-mix(in srgb, ${sectionColor} 25%, transparent)`,
                            paddingLeft: "0.5rem",
                            marginLeft: "1rem",
                          }}
                        >
                          {item.items?.map((subItem) => {
                            const isActive = currentPage === subItem.page
                            return (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton
                                  className="relative transition-all duration-150 rounded-md"
                                  isActive={isActive}
                                  onClick={() => {
                                    if (subItem.page) onSubItemClick?.(subItem.page)
                                  }}
                                >
                                  {isActive && (
                                    <span
                                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full"
                                      style={{ background: sectionColor, marginLeft: '-1rem' }}
                                    />
                                  )}
                                  <span className={`text-[11px] font-medium text-foreground leading-tight ${isActive ? 'font-semibold' : ''}`}>{subItem.title}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )
                          })}
                        </SidebarMenuSub>
                      </div>
                    </div>
                  </>
                ) : null}
              </SidebarMenuItem>
            </Collapsible>
          )
        })
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
