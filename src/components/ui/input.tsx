import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const isPassword = type === "password";
    const inputType = isPassword && showPassword ? "text" : type;

    return (
      <div className="relative">
        <input
          type={inputType}
          className={cn(
            "flex h-10 w-full rounded-md border-0 bg-secondary/50 px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            isPassword && "pr-10",
            className,
          )}
          ref={ref}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
