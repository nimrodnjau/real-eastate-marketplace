import { useEffect, useRef, useState } from 'react';
import { COUNTRIES } from '../constants/countries';
import '../styles/country-select.css';

const flagUrl = (code) => `https://flagcdn.com/24x18/${code}.png`;

// Native <select> can't render flag images inside its options in any browser,
// so this is a custom dropdown: a button showing the current flag + name,
// which opens a searchable list of flag + name rows.
//
// Self-contained: imports its own CSS and reads global design tokens
// (defined in styles/tokens.css), so it works on any page — not just
// inside the auth split-screen layout.
//
// Pass `allowClear` for filter contexts (e.g. a listings search) where
// "no country selected" should mean "show all countries".
export default function CountrySelect({
  id,
  label,
  value,
  onChange,
  className = '',
  placeholder = 'Select a country',
  allowClear = false,
  clearLabel = 'All countries',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  const selected = COUNTRIES.find((c) => c.name === value);

  const filtered = query
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : COUNTRIES;

  const showClearOption =
    allowClear && (!query || clearLabel.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const handleSelect = (name) => {
    onChange(name);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showClearOption && filtered.length === 0) handleSelect('');
      else if (filtered.length > 0) handleSelect(filtered[0].name);
    }
  };

  const triggerLabel = selected
    ? selected.name
    : !value && allowClear
    ? clearLabel
    : placeholder;

  return (
    <div className={`country-select-wrap ${className}`.trim()} ref={wrapRef}>
      {label && (
        <label className="country-select-label" htmlFor={id}>
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        className="country-select-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected && <img className="country-flag" src={flagUrl(selected.code)} alt="" />}
        <span>{triggerLabel}</span>
        <svg className="country-select-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="country-select-dropdown" role="listbox">
          <input
            ref={searchRef}
            type="text"
            className="country-select-search"
            placeholder="Search countries…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="country-select-list">
            {showClearOption && (
              <button
                type="button"
                role="option"
                aria-selected={!value}
                className="country-option country-option--clear"
                onClick={() => handleSelect('')}
              >
                <span>{clearLabel}</span>
              </button>
            )}
            {filtered.length === 0 && !showClearOption && (
              <p className="country-select-empty">No matches.</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={c.name === value}
                className={`country-option${c.name === value ? ' country-option--selected' : ''}`}
                onClick={() => handleSelect(c.name)}
              >
                <img className="country-flag" src={flagUrl(c.code)} alt="" />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}