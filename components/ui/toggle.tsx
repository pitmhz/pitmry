import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium text-xs transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-foreground/[0.08] data-[state=on]:text-foreground [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-border bg-transparent hover:bg-muted hover:text-foreground",
      },
      size: {
        default: "h-8 px-2 min-w-8",
        sm: "h-7 px-1.5 min-w-7",
        lg: "h-9 px-3 min-w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ToggleProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof toggleVariants> {
  pressed?: boolean
  defaultPressed?: boolean
  onPressedChange?: (pressed: boolean) => void
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  (
    {
      className,
      variant,
      size,
      pressed: controlledPressed,
      defaultPressed = false,
      onPressedChange,
      onClick,
      ...props
    },
    ref
  ) => {
    const [isPressed, setIsPressed] = React.useState(defaultPressed)
    const pressed = controlledPressed !== undefined ? controlledPressed : isPressed

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (controlledPressed === undefined) {
        setIsPressed(!isPressed)
      }
      onPressedChange?.(!pressed)
      onClick?.(e)
    }

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={pressed}
        data-state={pressed ? "on" : "off"}
        data-slot="toggle"
        className={cn(toggleVariants({ variant, size, className }))}
        onClick={handleClick}
        {...props}
      />
    )
  }
)
Toggle.displayName = "Toggle"

export { Toggle, toggleVariants }
