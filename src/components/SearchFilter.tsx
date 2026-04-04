import React, { useState, useEffect, useRef, useCallback } from "react";

export interface SearchItem {
  id: string;
  label: string;
  sublabel?: string;
}

interface Props {
  placeholder?: string;
  items: SearchItem[];
  onSelect: (item: SearchItem) => void;
}

export default function SearchFilter({ placeholder = "Search…", items, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? items
        .filter((item) => {
          const q = query.toLowerCase();
          return (
            item.label.toLowerCase().includes(q) ||
            (item.sublabel?.toLowerCase().includes(q) ?? false)
          );
        })
        .slice(0, 10)
    : [];

  const handleSelect = useCallback(
    (item: SearchItem) => {
      setQuery("");
      setOpen(false);
      setActiveIndex(-1);
      onSelect(item);
    },
    [onSelect]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        handleSelect(filtered[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setOpen(true);
    setActiveIndex(-1);
  };

  return (
    <div ref={containerRef} className="relative w-full mb-4">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => query.trim() && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-expanded={open && filtered.length > 0}
        aria-haspopup="listbox"
        autoComplete="off"
        className="w-full bg-white border border-votescot-border rounded-lg px-3.5 py-2.5 font-body text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-votescot-gold transition-colors"
      />
      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 bg-white border border-votescot-border rounded-lg shadow-md overflow-hidden"
        >
          {filtered.map((item, i) => (
            <li
              key={item.id}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(item);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className="px-3.5 py-2.5 cursor-pointer font-body text-sm flex items-baseline justify-between gap-3"
              style={{
                background: i === activeIndex ? "#1a1a2e" : "white",
                color: i === activeIndex ? "#fff" : "#333",
              }}
            >
              <span className="font-bold truncate">{item.label}</span>
              {item.sublabel && (
                <span
                  className="shrink-0 text-xs"
                  style={{ color: i === activeIndex ? "#c4940a" : "#9ca3af" }}
                >
                  {item.sublabel}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
