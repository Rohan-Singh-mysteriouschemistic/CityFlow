import { useState, useEffect, useCallback, useRef } from 'react'
import Map, { Source, Layer, Marker } from 'react-map-gl/mapbox'
import { fetchRoute } from '../utils/mapUtils'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

/**
 * MapRoute — A premium dark-mode Mapbox map displaying a driving route
 * between pickup and drop coordinates.
 *
 * Props:
 *   pickupCoords — [lng, lat] array for pickup location
 *   dropCoords   — [lng, lat] array for drop location
 *   height       — CSS height string (default: '300px')
 *   routeGeometry — Pre-fetched GeoJSON geometry (optional, avoids re-fetch)
 */
export default function MapRoute({ pickupCoords, dropCoords, height = '300px', routeGeometry = null }) {
  const [route, setRoute] = useState(null)
  const [viewState, setViewState] = useState({
    longitude: 77.2090,
    latitude: 28.6139,
    zoom: 11
  })
  const mapRef = useRef(null)

  // Fit bounds when coords change
  const fitBounds = useCallback(() => {
    if (!pickupCoords || !dropCoords || !mapRef.current) return
    try {
      const padding = { top: 50, bottom: 50, left: 50, right: 50 }
      const sw = [
        Math.min(pickupCoords[0], dropCoords[0]),
        Math.min(pickupCoords[1], dropCoords[1])
      ]
      const ne = [
        Math.max(pickupCoords[0], dropCoords[0]),
        Math.max(pickupCoords[1], dropCoords[1])
      ]
      mapRef.current.fitBounds([sw, ne], { padding, duration: 800 })
    } catch {}
  }, [pickupCoords, dropCoords])

  // Fetch route on coord change
  useEffect(() => {
    if (routeGeometry) {
      setRoute(routeGeometry)
      setTimeout(fitBounds, 100)
      return
    }
    if (!pickupCoords || !dropCoords) return
    let cancelled = false
    ;(async () => {
      const data = await fetchRoute(pickupCoords, dropCoords)
      if (!cancelled && data?.geometry) {
        setRoute(data.geometry)
        setTimeout(fitBounds, 100)
      } else if (!cancelled) {
        // Even if route fails, still center the map
        setTimeout(fitBounds, 100)
      }
    })()
    return () => { cancelled = true }
  }, [pickupCoords?.[0], pickupCoords?.[1], dropCoords?.[0], dropCoords?.[1], routeGeometry]) // eslint-disable-line react-hooks/exhaustive-deps

  // Token check
  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes('your_mapbox')) {
    return (
      <div style={{
        height, borderRadius: 12, background: '#181c24',
        border: '1px solid #2a2f3e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 8
      }}>
        <span style={{ fontSize: 28 }}>🗺️</span>
        <span style={{ fontSize: 12, color: '#4a5270' }}>
          Add VITE_MAPBOX_TOKEN to .env to enable maps
        </span>
      </div>
    )
  }

  // No coords
  if (!pickupCoords || !dropCoords) {
    return (
      <div style={{
        height, borderRadius: 12, background: '#181c24',
        border: '1px solid #2a2f3e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 8
      }}>
        <span style={{ fontSize: 28 }}>📍</span>
        <span style={{ fontSize: 12, color: '#4a5270' }}>
          Select pickup & drop to see route
        </span>
      </div>
    )
  }

  const routeGeoJSON = route ? {
    type: 'Feature',
    properties: {},
    geometry: route
  } : null

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', height, position: 'relative' }}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={e => setViewState(e.viewState)}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        interactive={true}
      >
        {/* Route glow (halo) */}
        {routeGeoJSON && (
          <Source type="geojson" data={routeGeoJSON}>
            <Layer
              id="route-halo"
              type="line"
              paint={{
                'line-color': '#4f8cff',
                'line-width': 10,
                'line-opacity': 0.15,
                'line-blur': 8
              }}
            />
            <Layer
              id="route-line"
              type="line"
              paint={{
                'line-color': '#4f8cff',
                'line-width': 3.5,
                'line-opacity': 0.9
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round'
              }}
            />
          </Source>
        )}

        {/* Pickup marker */}
        <Marker longitude={pickupCoords[0]} latitude={pickupCoords[1]} anchor="center">
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: '#4f8cff', border: '3px solid #fff',
            boxShadow: '0 0 12px rgba(79,140,255,.6), 0 0 24px rgba(79,140,255,.2)',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute', inset: -6, borderRadius: '50%',
              border: '2px solid rgba(79,140,255,.3)',
              animation: 'mapPulse 2s ease-out infinite'
            }} />
          </div>
        </Marker>

        {/* Drop marker */}
        <Marker longitude={dropCoords[0]} latitude={dropCoords[1]} anchor="center">
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: '#7c6aff', border: '3px solid #fff',
            boxShadow: '0 0 12px rgba(124,106,255,.6), 0 0 24px rgba(124,106,255,.2)',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute', inset: -6, borderRadius: '50%',
              border: '2px solid rgba(124,106,255,.3)',
              animation: 'mapPulse 2s ease-out infinite .5s'
            }} />
          </div>
        </Marker>
      </Map>

      {/* Inline label overlays */}
      <div style={{
        position: 'absolute', top: 10, left: 10,
        display: 'flex', gap: 6, zIndex: 2
      }}>
        <span style={{
          background: 'rgba(79,140,255,.2)', color: '#4f8cff',
          fontSize: 10, fontWeight: 600, padding: '3px 8px',
          borderRadius: 6, backdropFilter: 'blur(6px)',
          border: '1px solid rgba(79,140,255,.3)'
        }}>● PICKUP</span>
        <span style={{
          background: 'rgba(124,106,255,.2)', color: '#7c6aff',
          fontSize: 10, fontWeight: 600, padding: '3px 8px',
          borderRadius: 6, backdropFilter: 'blur(6px)',
          border: '1px solid rgba(124,106,255,.3)'
        }}>● DROP</span>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes mapPulse {
          0%   { transform: scale(1);   opacity: 1; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
