import * as React from "react"
import { cn } from "@/lib/utils"

interface InputGroupProps extends React.ComponentProps<"div"> {}

function InputGroup({ className, children, ...props }: InputGroupProps) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "relative flex h-8 items-center rounded-lg border border-border bg-background px-2 text-xs transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface InputGroupAddonProps extends React.ComponentProps<"div"> {
  align?: "inline-start" | "inline-end"
}

function InputGroupAddon({
  className,
  align = "inline-start",
  children,
  ...props
}: InputGroupAddonProps) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn(
        "flex shrink-0 items-center justify-center text-muted-foreground select-none",
        align === "inline-start" ? "mr-1.5" : "ml-1.5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface InputGroupInputProps
  extends React.ComponentProps<"input"> {
  nativeInput?: boolean
}

const InputGroupInput = React.forwardRef<HTMLInputElement, InputGroupInputProps>(
  ({ className, nativeInput, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input-group-input"
        className={cn(
          "h-full w-full flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-0 p-0 focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    )
  }
)
InputGroupInput.displayName = "InputGroupInput"

export { InputGroup, InputGroupAddon, InputGroupInput }
