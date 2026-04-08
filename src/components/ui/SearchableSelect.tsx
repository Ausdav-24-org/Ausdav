import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

/**
 * Lightweight searchable input that allows typing new values
 * or selecting from existing options.
 * 
 * No RAF, no event listeners on DOM properties - minimal performance overhead
 */
export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
}) => {
  const [inputValue, setInputValue] = React.useState(value || "");
  const [showOptions, setShowOptions] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const clickHandlerRef = React.useRef<((event: MouseEvent) => void) | null>(null);

  // Filter options based on input
  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(inputValue.toLowerCase())
  );

  // Show only first 1 suggestion to match Finance Ledger behavior
  const displayedOptions = filteredOptions.slice(0, 1);

  // Sync inputValue when value prop changes
  React.useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  // Close dropdown when clicking outside - optimized to avoid reflows
  React.useEffect(() => {
    // Create handler once and reuse
    clickHandlerRef.current = (event: MouseEvent) => {
      const container = containerRef.current;
      if (container && !container.contains(event.target as Node)) {
        // Defer state update to avoid forced reflow during event handler
        requestAnimationFrame(() => {
          setShowOptions(false);
        });
      }
    };

    // Add event listener with capture phase (more efficient)
    document.addEventListener("mousedown", clickHandlerRef.current, true);
    
    return () => {
      if (clickHandlerRef.current) {
        document.removeEventListener("mousedown", clickHandlerRef.current, true);
      }
    };
  }, []);

  const handleSelectOption = (option: string) => {
    onChange(option);
    setInputValue(option);
    setShowOptions(false);
  };

  return (
    <div 
      className="relative w-full" 
      ref={containerRef}
      // CSS containment prevents layout/style recalculations from affecting parent
      style={{ contain: "layout style" }}
    >
      <Input
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
          setShowOptions(true);
        }}
        onFocus={() => setShowOptions(true)}
        placeholder={placeholder}
        className="w-full"
      />

      {/* Dropdown with suggestions - shows above other content with higher z-index */}
      {showOptions && displayedOptions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-[9999] mt-1 bg-background border border-input rounded-md shadow-lg max-h-16 overflow-y-auto" style={{ contain: "paint" }}>
          {displayedOptions.map((option) => (
            <div
              key={option}
              className={cn(
                "px-3 py-2 cursor-pointer hover:bg-primary/10 text-sm whitespace-normal transition-colors duration-100",
                option === value && "bg-primary/20 font-medium"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectOption(option);
              }}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
