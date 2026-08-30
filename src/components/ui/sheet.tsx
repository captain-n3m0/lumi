"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

interface SheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheetContext() {
  const context = React.useContext(SheetContext);
  if (!context) {
    throw new Error("Sheet components must be used within a Sheet provider");
  }
  return context;
}

const Sheet: React.FC<SheetProps> = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? !!controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen);
      }
      onOpenChange?.(newOpen);
    },
    [isControlled, onOpenChange],
  );

  return <SheetContext.Provider value={{ open, setOpen }}>{children}</SheetContext.Provider>;
};

const SheetTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ asChild, children, onClick, ...props }, ref) => {
  const ctx = React.useContext(SheetContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented) {
      ctx?.setOpen(true);
    }
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>,
      {
        onClick: (e: React.MouseEvent) => {
          (
            children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
          ).props.onClick?.(e);
          if (!e.defaultPrevented) {
            ctx?.setOpen(true);
          }
        },
      },
    );
  }

  return (
    <button ref={ref} type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
});
SheetTrigger.displayName = "SheetTrigger";

const SheetClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ asChild, children, onClick, ...props }, ref) => {
  const ctx = React.useContext(SheetContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented) {
      ctx?.setOpen(false);
    }
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>,
      {
        onClick: (e: React.MouseEvent) => {
          (
            children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
          ).props.onClick?.(e);
          if (!e.defaultPrevented) {
            ctx?.setOpen(false);
          }
        },
      },
    );
  }

  return (
    <button ref={ref} type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
});
SheetClose.displayName = "SheetClose";

const SheetPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const ctx = React.useContext(SheetContext);
  if (!ctx?.open) return null;
  if (!mounted || typeof document === "undefined") return null;

  return createPortal(children, document.body);
};

const SheetOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, onClick, ...props }, ref) => {
    const ctx = React.useContext(SheetContext);

    return (
      <div
        ref={ref}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) {
            ctx?.setOpen(false);
          }
        }}
        className={cn(
          "fixed inset-0 z-50 bg-black/80 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in-0",
          className,
        )}
        {...props}
      />
    );
  },
);
SheetOverlay.displayName = "SheetOverlay";

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-2xl transition ease-in-out duration-300 animate-in",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b slide-in-from-top",
        bottom: "inset-x-0 bottom-0 border-t slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r slide-in-from-left sm:max-w-sm",
        right: "inset-y-0 right-0 h-full w-3/4 border-l slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ side = "right", className, children, ...props }, ref) => {
    const ctx = useSheetContext();

    React.useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          ctx.setOpen(false);
        }
      };
      if (ctx.open) {
        window.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";
      }
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }, [ctx]);

    if (!ctx.open) return null;

    return (
      <SheetPortal>
        <SheetOverlay />
        <div ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
          <button
            type="button"
            onClick={() => ctx.setOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none p-1 hover:bg-muted"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          {children}
        </div>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = "SheetContent";

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
  ),
);
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
