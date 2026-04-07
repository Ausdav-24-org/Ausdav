import * as React from "react";
import ReactDOM from "react-dom";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SchoolComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  autoOpenWhen?: boolean;
}

export const SchoolCombobox: React.FC<SchoolComboboxProps> = ({ value, onChange, options, placeholder, autoOpenWhen = false }) => {
  const [inputValue, setInputValue] = React.useState(value || "");
  const [showList, setShowList] = React.useState(autoOpenWhen && options.length > 0);
  const filtered = options.filter(option => option.toLowerCase().includes(inputValue.toLowerCase()));

  // dropdown sizing: show up to 3 items at once, shrink to 2/1 when filtered is smaller
  const ITEM_HEIGHT = 44; // px per list item (keeps size consistent)
  const visibleCount = Math.min(Math.max(filtered.length, 1), 3);

  React.useEffect(() => {
    // Sync inputValue when value prop changes from parent
    setInputValue(value || "");
  }, [value]);

  React.useEffect(() => {
    if (autoOpenWhen && options.length > 0) {
      setShowList(true);
    }
  }, [autoOpenWhen, options.length]);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [portalStyle, setPortalStyle] = React.useState<React.CSSProperties>({});
  const rafRef = React.useRef<number | null>(null);
  const debounceTimerRef = React.useRef<number | null>(null);

  const updatePortalPosition = React.useCallback(() => {
    // Cancel any pending updates
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    // Use requestAnimationFrame to batch DOM reads with renders
    rafRef.current = requestAnimationFrame(() => {
      const el = containerRef.current;
      if (!el) return;
      
      const rect = el.getBoundingClientRect();
      setPortalStyle({
        position: "fixed",
        left: rect.left,
        top: rect.bottom,
        width: rect.width,
        zIndex: 9999,
      });
    });
  }, []);

  const debouncedUpdatePosition = React.useCallback(() => {
    // Cancel previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Debounce scroll/resize events by 100ms
    debounceTimerRef.current = window.setTimeout(() => {
      updatePortalPosition();
    }, 100);
  }, [updatePortalPosition]);

  React.useEffect(() => {
    if (!showList) {
      // Cleanup RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      return;
    }
    
    // Initial position update
    updatePortalPosition();
    
    // Use debounced position updates for resize/scroll
    window.addEventListener("resize", debouncedUpdatePosition);
    window.addEventListener("scroll", debouncedUpdatePosition, true);
    
    return () => {
      window.removeEventListener("resize", debouncedUpdatePosition);
      window.removeEventListener("scroll", debouncedUpdatePosition, true);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [showList, updatePortalPosition, debouncedUpdatePosition]);

  return (
    <div className="relative font-sans" ref={containerRef}>
      <Input
        value={inputValue}
        onChange={e => {
          setInputValue(e.target.value);
          setShowList(true);
        }}
        onFocus={() => setShowList(true)}
        onBlur={() => {
          // Defer dropdown closing to allow selection to be processed
          // Reduced from 100ms to 75ms for better responsiveness
          setTimeout(() => setShowList(false), 75);
        }}
        placeholder={placeholder}
        className="w-full rounded-sm"
      />

      {showList && filtered.length > 0 && typeof document !== "undefined" && ReactDOM.createPortal(
        <ul
          style={{ ...portalStyle, maxHeight: `${visibleCount * ITEM_HEIGHT}px`, overflow: 'auto' }}
          className="bg-background border border-input rounded-none rounded-b-md shadow-lg scrollbar-thin scrollbar-dark font-sans leading-normal"
        >
          {filtered.map(option => (
            <li
              key={option}
              style={{ minHeight: `${ITEM_HEIGHT}px` }}
              className={cn(
                "px-3 py-2 cursor-pointer hover:bg-primary/20 whitespace-normal",
                option === value && "bg-primary text-primary-foreground"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                // Call onChange first to update parent
                onChange(option);
                // Close dropdown
                setShowList(false);
                // Let the useEffect sync inputValue from the updated value prop
              }}
            >
              {option}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
};
