import { cn } from "@/lib/utils"
import { Loader } from "lucide-react"

type LoadingSpinnerProps = {
  size?: number
  className?: string
}

export function LoadingSpinner({ size = 20, className }: LoadingSpinnerProps) {
  return (
    <Loader
      className={cn("animate-spin text-primary shrink-0", className)}
      style={{ width: size, height: size }}
    />
  )
}

type LoadingStateProps = {
  message?: string
  description?: string
  className?: string
}

export function LoadingState({ message = "Loading", description, className }: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className ?? ""}`}>
      <LoadingSpinner size={32} className="text-muted-foreground" />
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground animate-pulse">{message}</p>
        {description ? <p className="text-xs text-muted-foreground mt-1">{description}</p> : null}
      </div>
    </div>
  )
}
