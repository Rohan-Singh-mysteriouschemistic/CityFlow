import { useEffect, useRef } from 'react'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

/**
 * MapRoute — renders a Mapbox GL map with pickup/dropoff markers
 * and an optional route line.
 *
 * Props:
 *   pickupCoords    — [lng, lat]
 *   dropCoords      — [lng, lat]
 *   height          — CSS height string (default: '280px')
 *   routeGeometry   — GeoJSON geometry from Directions API (optional)
 */
export default function MapRoute({ pickupCoords, dropCoords, height = '280px', routeGeometry }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const markersRef   = useRef([])

  useEffect(() => {
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes('your_mapbox')) return
    if (!pickupCoords || !dropCoords) return

    // Lazy-load mapbox-gl to avoid SSR issues
    import('mapbox-gl').then(({ default: mapboxgl }) => {
      mapboxgl.accessToken = MAPBOX_TOKEN

      if (mapRef.current) {
        // Map already exists — update markers and route
        updateMap(mapboxgl)
        return
      }

      const center = [
        (pickupCoords[0] + dropCoords[0]) / 2,
        (pickupCoords[1] + dropCoords[1]) / 2,
      ]

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center,
        zoom: 11,
        attributionControl: false,
      })

      map.addControl(new mapboxgl.AttributionControl({ compact: true }))

      mapRef.current = map

      map.on('load', () => {
        addMarkers(mapboxgl)
        if (routeGeometry) addRoute()
        fitBounds(map)
      })
    })

    return () => {
      // Clean up markers on prop changes
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
    }
  }, [pickupCoords, dropCoords, routeGeometry]) // eslint-disable-line react-hooks/exhaustive-deps

  function addMarkers(mapboxgl) {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const pickupEl = makeMarkerEl('var(--status-success)')
    const dropEl   = makeMarkerEl('var(--status-danger)')

    const pickup = new mapboxgl.Marker({ element: pickupEl })
      .setLngLat(pickupCoords)
      .addTo(mapRef.current)

    const drop = new mapboxgl.Marker({ element: dropEl })
      .setLngLat(dropCoords)
      .addTo(mapRef.current)

    markersRef.current = [pickup, drop]
  }

  function addRoute() {
    const map = mapRef.current
    if (!map) return

    if (map.getSource('route')) {
      map.getSource('route').setData({ type: 'Feature', geometry: routeGeometry })
    } else {
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', geometry: routeGeometry },
      })
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#1A56DB', 'line-width': 3 },
      })
    }
  }

  function fitBounds(map) {
    import('mapbox-gl').then(({ default: mapboxgl }) => {
      const bounds = new mapboxgl.LngLatBounds()
      bounds.extend(pickupCoords)
      bounds.extend(dropCoords)
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 })
    })
  }

  function updateMap(mapboxgl) {
    addMarkers(mapboxgl)
    if (routeGeometry) addRoute()
    fitBounds(mapRef.current)
  }

  function makeMarkerEl(color) {
    const el = document.createElement('div')
    el.style.cssText = [
      `width: 14px`,
      `height: 14px`,
      `border-radius: 50%`,
      `background-color: ${color}`,
      `border: 2px solid var(--bg-surface)`,
      `box-shadow: 0 1px 4px rgba(0,0,0,0.25)`,
    ].join(';')
    return el
  }

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes('your_mapbox')) {
    return (
      <div className="map-container map-container--placeholder" style={{ height }}>
        Map unavailable — set VITE_MAPBOX_TOKEN
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="map-container"
      style={{ height }}
      aria-label="Route map"
    />
  )
}
