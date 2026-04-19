import { useState, useRef, useEffect } from 'react'
import { searchPlaces } from '../utils/mapUtils'

/**
 * LocationSearch — Mapbox geocoder input with suggestion dropdown.
 * Keeps all geocoding logic; uses only token-based CSS classes.
 *
 * Props:
 *   label       — string shown above the input
 *   placeholder — input placeholder text
 *   value       — controlled display value (address string)
 *   onSelect    — callback({ address, lat, lng })
 */
export default function LocationSearch({ label, placeholder, value, onSelect }) {
  const [query,       setQuery]       = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [loading,     setLoading]     = useState(false)
  const [open,        setOpen]        = useState(false)
  const debounceRef = useRef(null)
  const wrapRef     = useRef(null)

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    setQuery(value || '')
  }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleChange(e) {
    const q = e.target.value
    setQuery(q)
    clearTimeout(debounceRef.current)
    if (!q.trim()) {
      setSuggestions([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const results = await searchPlaces(q)
      setSuggestions(results)
      setOpen(results.length > 0)
      setLoading(false)
    }, 300)
  }

  function handleSelect(place) {
    setQuery(place.address)
    setSuggestions([])
    setOpen(false)
    onSelect({ address: place.address, lat: place.lat, lng: place.lng })
  }

  return (
    <div className="location-search" ref={wrapRef}>
      {label && <label className="label">{label}</label>}
      <input
        type="text"
        className="input"
        placeholder={placeholder || 'Search location'}
        value={query}
        onChange={handleChange}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {loading && (
        <div className="location-search__status">Searching…</div>
      )}
      {open && suggestions.length > 0 && (
        <ul className="location-search__suggestions" role="listbox">
          {suggestions.map((place, i) => (
            <li
              key={i}
              className="location-search__item"
              role="option"
              onMouseDown={() => handleSelect(place)}
            >
              {place.place_name || place.address}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
