import { useState, useRef, useEffect, useCallback } from 'react'
import { searchPlaces } from '../utils/mapUtils'

/**
 * LocationSearch — A geocoding autocomplete input that queries Mapbox
 * and returns { address, lat, lng } when the user selects a suggestion.
 *
 * Props:
 *   label       — Field label text
 *   placeholder — Input placeholder
 *   value       — Current address string (controlled)
 *   onSelect    — Callback: ({ address, lat, lng }) => void
 */
export default function LocationSearch({ label, placeholder, value, onSelect }) {
  const [query, setQuery]         = useState(value || '')
  const [results, setResults]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [open, setOpen]           = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef(null)
  const wrapperRef  = useRef(null)

  // Sync controlled value
  useEffect(() => { setQuery(value || '') }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    const places = await searchPlaces(q)
    setResults(places)
    setOpen(places.length > 0)
    setActiveIdx(-1)
    setLoading(false)
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 350)
  }

  const handleSelect = (place) => {
    setQuery(place.address)
    setOpen(false)
    setResults([])
    onSelect?.({
      address: place.address,
      lat: place.lat,
      lng: place.lng
    })
  }

  const handleKeyDown = (e) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      handleSelect(results[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {label && (
        <label style={{
          fontSize: 12, color: '#8b93a8', marginBottom: 6, display: 'block'
        }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          style={{
            background: '#181c24', border: '1px solid #2a2f3e', borderRadius: 10,
            padding: '11px 14px', paddingRight: 36,
            color: '#e8eaf0', fontSize: 14, outline: 'none',
            width: '100%', boxSizing: 'border-box',
            borderColor: open ? '#4f8cff' : '#2a2f3e',
            transition: 'border-color .2s'
          }}
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
        />
        {/* Search icon / spinner */}
        <div style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: 14, color: '#4a5270', pointerEvents: 'none'
        }}>
          {loading ? (
            <span style={{ animation: 'spin .8s linear infinite', display: 'inline-block' }}>⟳</span>
          ) : '📍'}
        </div>
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: '#181c24', border: '1px solid #2a2f3e',
          borderRadius: 10, marginTop: 4, overflow: 'hidden',
          zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,.5)'
        }}>
          {results.map((place, i) => (
            <div
              key={i}
              onClick={() => handleSelect(place)}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                padding: '10px 14px', cursor: 'pointer',
                fontSize: 13, color: '#e8eaf0',
                background: activeIdx === i ? 'rgba(79,140,255,.12)' : 'transparent',
                borderBottom: i < results.length - 1 ? '1px solid #1e2330' : 'none',
                display: 'flex', alignItems: 'flex-start', gap: 8,
                transition: 'background .1s'
              }}
            >
              <span style={{
                color: activeIdx === i ? '#4f8cff' : '#4a5270',
                fontSize: 14, flexShrink: 0, marginTop: 1
              }}>📌</span>
              <span style={{
                overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>{place.place_name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Inline CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: translateY(-50%) rotate(0deg); }
          to   { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
