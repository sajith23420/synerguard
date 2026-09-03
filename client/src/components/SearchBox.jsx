import { useState, useRef, useEffect, useCallback } from 'react';
import { searchDrugs } from '../api';

/**
 * SearchBox component with live autocomplete
 * @param {Object} props
 * @param {Function} props.onSelect - Callback when a drug is selected
 * @param {string[]} props.selectedDrugs - Array of already selected drug names
 */
export default function SearchBox({ onSelect, selectedDrugs = [] }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isFuzzy, setIsFuzzy] = useState(false);
  // canonical name -> the synonym the user's query actually matched
  const [aliases, setAliases] = useState({});
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  // Filter out already selected drugs
  const filteredSuggestions = suggestions.filter(
    (drug) => !selectedDrugs.includes(drug)
  );

  // Debounced search
  const performSearch = useCallback(async (searchQuery) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      setIsFuzzy(false);
      setAliases({});
      return;
    }

    setIsLoading(true);
    try {
      const { results, fuzzy, aliases: matched } = await searchDrugs(searchQuery);
      setSuggestions(results);
      setIsFuzzy(fuzzy);
      setAliases(matched || {});
      setHighlightedIndex(-1);
    } catch (error) {
      console.error('Search failed:', error);
      setSuggestions([]);
      setIsFuzzy(false);
      setAliases({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debounce
  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 200);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) return;

    // Nothing to pick from — Enter records the typed name as unscreened
    if (filteredSuggestions.length === 0) {
      if (e.key === 'Enter' && query.trim().length >= 2) {
        e.preventDefault();
        handleAddUnverified();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
          handleSelect(filteredSuggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
      case 'Tab':
        if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
          e.preventDefault();
          handleSelect(filteredSuggestions[highlightedIndex]);
        }
        break;
      default:
        break;
    }
  };

  // Handle drug selection
  const handleSelect = (drug) => {
    onSelect(drug);
    setQuery('');
    setSuggestions([]);
    setIsFuzzy(false);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  // Add a name we hold no data for. The patient may genuinely be taking it, so
  // refusing to record it would hide it from the report entirely — instead it
  // goes in flagged as unscreened.
  const handleAddUnverified = () => {
    const name = query.trim();
    if (name) handleSelect(name);
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        inputRef.current !== e.target
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll('.autocomplete-item');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  return (
    <div className="search-section">
      <label htmlFor="drug-search" className="search-label">
        Search for a drug
      </label>
      <div className="autocomplete" ref={dropdownRef}>
        <svg className="autocomplete-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          id="drug-search"
          type="text"
          className="input input-with-icon"
          placeholder="Type at least 2 characters (e.g., warfarin)..."
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          autoComplete="off"
          aria-autocomplete="list"
          // Only point at the listbox when it is actually in the DOM — in the
          // fuzzy-miss and no-match states there is no list to control.
          aria-controls={filteredSuggestions.length > 0 ? 'drug-suggestions' : undefined}
          aria-expanded={isOpen && filteredSuggestions.length > 0}
        />
        {isLoading && <div className="spinner input-spinner" aria-hidden="true" />}

        {isOpen && !isLoading && query.length >= 2 && (
          <div className="autocomplete-dropdown">
            {isFuzzy && (
              <div className="autocomplete-note">
                No exact match for <strong>“{query}”</strong>
                {filteredSuggestions.length > 0 && ' — did you mean:'}
              </div>
            )}

            {filteredSuggestions.length > 0 && (
              <ul id="drug-suggestions" role="listbox" aria-label="Drug suggestions">
                {filteredSuggestions.map((drug, index) => (
                  <li
                    key={drug}
                    className={`autocomplete-item ${index === highlightedIndex ? 'highlighted' : ''}`}
                    role="option"
                    aria-selected={index === highlightedIndex}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseLeave={() => setHighlightedIndex(-1)}
                    onClick={() => handleSelect(drug)}
                  >
                    <span className="autocomplete-item-text">
                      <span className="autocomplete-item-name">{drug}</span>
                      {/* The query matched a synonym with far less interaction
                          data, so the search was redirected here. Say so — a
                          silent swap changes which medicine gets screened. */}
                      {aliases[drug] && (
                        <span className="autocomplete-item-alias">
                          matched “{aliases[drug]}” — screened as {drug}
                        </span>
                      )}
                    </span>
                    <span className="autocomplete-item-hint" aria-hidden="true">Enter ↵</span>
                  </li>
                ))}
              </ul>
            )}

            {filteredSuggestions.length === 0 && !isFuzzy && (
              <div className="autocomplete-empty">No drugs found matching “{query}”</div>
            )}

            {(isFuzzy || filteredSuggestions.length === 0) && (
              <button type="button" className="autocomplete-add" onClick={handleAddUnverified}>
                <span className="autocomplete-add-icon" aria-hidden="true">+</span>
                <span>
                  <span className="autocomplete-add-name">Add “{query}” anyway</span>
                  <span className="autocomplete-add-hint">
                    Recorded but not screened — no interaction data available
                  </span>
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}