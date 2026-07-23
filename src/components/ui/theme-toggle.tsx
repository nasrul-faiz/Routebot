import { Sun, Moon } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"

export function ThemeToggle() {
  const { mode, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle color theme"
      className="ml-2 inline-flex items-center justify-center h-8 w-8 rounded-md border border-input text-muted-foreground hover:bg-muted/40 transition-colors"
    >
      {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}

export default ThemeToggle
