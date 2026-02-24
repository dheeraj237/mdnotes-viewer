import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface CollapsibleSectionProps {
  title: string;
  isDefaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  storageKey?: string; // Optional storage key to persist state
}

export function CollapsibleSection({
  title,
  isDefaultOpen = true,
  children,
  className,
  headerClassName,
  storageKey,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(isDefaultOpen);

  // Load saved state on mount
  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`collapsible-${storageKey}`);
      if (saved !== null) {
        setIsOpen(saved === 'true');
      }
    }
  }, [storageKey]);

  // Save state when changed
  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    
    if (storageKey) {
      localStorage.setItem(`collapsible-${storageKey}`, newState.toString());
    }
  };

  return (
    <div className={cn("", className)}>
      <button
        onClick={handleToggle}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent/50 transition-colors focus:outline-none focus:bg-accent/50",
          headerClassName
        )}
      >
        <span>{title}</span>
        {isOpen ? (
          <ChevronDown className="h-3 w-3 transition-transform duration-200" />
        ) : (
          <ChevronRight className="h-3 w-3 transition-transform duration-200" />
        )}
      </button>
      <div className={cn(
        "overflow-hidden transition-all duration-200 ease-in-out",
        isOpen ? "max-h-[50vh] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="max-h-[inherit] overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}