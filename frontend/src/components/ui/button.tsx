import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-gray-200 bg-transparent text-gray-900 hover:bg-gray-100 focus-visible:ring-gray-300 focus-visible:ring-offset-2",
        destructive:
          "border border-gray-200 bg-transparent text-gray-900 hover:bg-gray-100 focus-visible:ring-gray-300 focus-visible:ring-offset-2",
        outline:
          "border border-gray-200 bg-transparent text-gray-900 hover:bg-gray-100 focus-visible:ring-gray-300 focus-visible:ring-offset-2",
        secondary:
          "border border-gray-200 bg-transparent text-gray-900 hover:bg-gray-100 focus-visible:ring-gray-300 focus-visible:ring-offset-2",
        ghost:
          "border border-gray-200 bg-transparent text-gray-900 hover:bg-gray-100 focus-visible:ring-gray-300 focus-visible:ring-offset-2",
        link: "border-0 text-gray-900 underline-offset-4 hover:underline hover:bg-transparent",
      },
      size: {
        default: "h-11 px-6",
        sm: "h-9 rounded-md px-4 text-sm",
        xs: "h-7 rounded-full px-2.5 text-[11px] gap-1",
        lg: "h-12 rounded-md px-8 text-lg",
        icon: "h-11 w-11 rounded-md",
        iconXs: "h-7 w-7 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
