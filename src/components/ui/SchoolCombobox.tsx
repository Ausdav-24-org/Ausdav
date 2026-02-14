import * as React from "react";
import ReactDOM from "react-dom";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SchoolComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

export const SchoolCombobox: React.FC<SchoolComboboxProps> = ({ value, onChange, options, placeholder }) => {
  const [inputValue, setInputValue] = React.useState(value || "");
  const [showList, setShowList] = React.useState(false);
  const filtered = options.filter(option => option.toLowerCase().includes(inputValue.toLowerCase()));

  // dropdown sizing: show up to 3 items at once, shrink to 2/1 when filtered is smaller
  const ITEM_HEIGHT = 44; // px per list item (keeps size consistent)
  const visibleCount = Math.min(Math.max(filtered.length, 1), 3);

  React.useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [portalStyle, setPortalStyle] = React.useState<React.CSSProperties>({});

  const updatePortalPosition = React.useCallback(() => {
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
  }, []);

  React.useEffect(() => {
    if (!showList) return;
    updatePortalPosition();
    window.addEventListener("resize", updatePortalPosition);
    window.addEventListener("scroll", updatePortalPosition, true);
    return () => {
      window.removeEventListener("resize", updatePortalPosition);
      window.removeEventListener("scroll", updatePortalPosition, true);
    };
  }, [showList, updatePortalPosition]);

  return (
    <div className="relative font-sans" ref={containerRef}>
      <Input
        value={inputValue}
        onChange={e => {
          setInputValue(e.target.value);
          setShowList(true);
        }}
        onFocus={() => setShowList(true)}
        onBlur={() => setTimeout(() => setShowList(false), 100)}
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
              onMouseDown={() => {
                onChange(option);
                setInputValue(option);
                setShowList(false);
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
