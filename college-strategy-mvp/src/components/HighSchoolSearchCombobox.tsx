import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import "./HighSchoolSearchCombobox.css";

export type HighSchoolOption = {
  name: string;
  city: string;
  state: string;
  label: string;
};

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabelledBy?: string;
  disabled?: boolean;
  emptyHint?: string;
  manualHint?: string;
  loadingHint?: string;
};

export function HighSchoolSearchCombobox({
  id,
  value,
  onChange,
  placeholder,
  ariaLabelledBy,
  disabled,
  emptyHint = "No matches — you can keep your typed name.",
  manualHint,
  loadingHint = "Searching…",
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [options, setOptions] = useState<HighSchoolOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/high-schools/search?q=${encodeURIComponent(trimmed)}&limit=20`);
      const data = (await res.json()) as { schools?: HighSchoolOption[] };
      setOptions(Array.isArray(data.schools) ? data.schools : []);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void runSearch(query);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [open, query, runSearch]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function commitManual(next: string) {
    onChange(next.trim());
    setOpen(false);
  }

  function selectOption(opt: HighSchoolOption) {
    onChange(opt.label);
    setQuery(opt.label);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && options[activeIndex]) {
        selectOption(options[activeIndex]);
      } else {
        commitManual(query);
      }
    }
  }

  const showManual =
    query.trim().length >= 2 &&
    !loading &&
    options.every((o) => o.label.toLowerCase() !== query.trim().toLowerCase());

  return (
    <div className="hs-combobox" ref={rootRef}>
      <input
        id={id}
        className="input-modern input-modern--action hs-combobox__input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-labelledby={ariaLabelledBy}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            if (!rootRef.current?.contains(document.activeElement)) {
              commitManual(query);
            }
          }, 120);
        }}
        onKeyDown={onKeyDown}
      />
      {open && query.trim().length >= 2 ? (
        <ul id={listId} className="hs-combobox__list" role="listbox">
          {loading ? <li className="hs-combobox__hint">{loadingHint}</li> : null}
          {!loading && options.length === 0 ? <li className="hs-combobox__hint">{emptyHint}</li> : null}
          {options.map((opt, index) => (
            <li key={`${opt.name}-${opt.city}-${opt.state}`} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`hs-combobox__option${index === activeIndex ? " hs-combobox__option--active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(opt)}
              >
                <span className="hs-combobox__name">{opt.name}</span>
                <span className="hs-combobox__meta">
                  {opt.city ? `${opt.city}, ` : ""}
                  {opt.state}
                </span>
              </button>
            </li>
          ))}
          {showManual && manualHint ? (
            <li className="hs-combobox__hint hs-combobox__hint--manual">{manualHint}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
