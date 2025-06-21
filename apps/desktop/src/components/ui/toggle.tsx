import * as React from "react"
import { cn } from "@/lib/utils"

interface ToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ checked, onCheckedChange, disabled = false, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          "data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
          "h-10 px-3",
          checked && "bg-accent text-accent-foreground",
          className
        )}
        data-state={checked ? "on" : "off"}
        {...props}
      >
        {children || (checked ? "Enabled" : "Disabled")}
      </button>
    )
  }
)

Toggle.displayName = "Toggle"

export { Toggle } 