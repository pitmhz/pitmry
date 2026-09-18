"use client"

import * as React from "react"
import { type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

interface ToggleGroupContextValue {
  value: string[]
  onValueChange: (val: string) => void
  size?: "default" | "sm" | "lg"
  variant?: "default" | "outline"
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(null)

interface ToggleGroupProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toggleVariants> {
  type?: "single" | "multiple"
  value?: string | string[]
  defaultValue?: string | string[]
  onValueChange?: (value: string[] | string) => void
  disabled?: boolean
}

const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      type = "single",
      value: controlledValue,
      defaultValue = [],
      onValueChange,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const normalize = (val?: string | string[]): string[] => {
      if (!val) return []
      return Array.isArray(val) ? val : [val]
    }

    const [uncontrolledValue, setUncontrolledValue] = React.useState<string[]>(
      normalize(defaultValue)
    )

    const currentValue = controlledValue !== undefined ? normalize(controlledValue) : uncontrolledValue

    const handleItemToggle = React.useCallback(
      (itemValue: string) => {
        let nextValue: string[]
        if (type === "single") {
          nextValue = currentValue.includes(itemValue) ? [] : [itemValue]
        } else {
          nextValue = currentValue.includes(itemValue)
            ? currentValue.filter((v) => v !== itemValue)
            : [...currentValue, itemValue]
        }

        if (controlledValue === undefined) {
          setUncontrolledValue(nextValue)
        }
        onValueChange?.(type === "single" ? nextValue[0] || "" : nextValue)
      },
      [currentValue, controlledValue, onValueChange, type]
    )

    return (
      <ToggleGroupContext.Provider
        value={{
          value: currentValue,
          onValueChange: handleItemToggle,
          size: size || "default",
          variant: variant || "default",
        }}
      >
        <div
          ref={ref}
          role="group"
          data-slot="toggle-group"
          className={cn(
            "inline-flex items-center justify-center gap-0.5 rounded-lg border border-border/80 bg-muted/30 p-0.5",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </ToggleGroupContext.Provider>
    )
  }
)
ToggleGroup.displayName = "ToggleGroup"

interface ToggleGroupItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof toggleVariants> {
  value: string
}

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ className, value, children, variant: itemVariant, size: itemSize, ...props }, ref) => {
    const context = React.useContext(ToggleGroupContext)
    const isSelected = context?.value.includes(value) ?? false

    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={isSelected}
        data-state={isSelected ? "on" : "off"}
        data-slot="toggle-group-item"
        className={cn(
          toggleVariants({
            variant: itemVariant || context?.variant || "default",
            size: itemSize || context?.size || "default",
          }),
          "rounded-md transition-all",
          isSelected
            ? "bg-background text-foreground shadow-xs font-semibold"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          className
        )}
        onClick={() => context?.onValueChange(value)}
        {...props}
      >
        {children}
      </button>
    )
  }
)
ToggleGroupItem.displayName = "ToggleGroupItem"

export { ToggleGroup, ToggleGroupItem }
