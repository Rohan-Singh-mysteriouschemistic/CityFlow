const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

/**
 * Fetch driving route between two points using Mapbox Directions API.
 * Returns { distance_km, duration_min, geometry } or null on failure.
 */
export async function fetchRoute(pickupCoords, dropCoords, stopsCoords = []) {
  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes('your_mapbox')) return null
  try {
    const coordsStr = [pickupCoords, ...stopsCoords, dropCoords]
      .map(c => `${c[0]},${c[1]}`)
      .join(';');
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.routes || data.routes.length === 0) return null
    const route = data.routes[0]
    return {
      distance_km: parseFloat((route.distance / 1000).toFixed(2)),
      duration_min: parseFloat((route.duration / 60).toFixed(1)),
      geometry: route.geometry
    }
  } catch {
    return null
  }
}

/**
 * Haversine distance (straight-line) between two lat/lng pairs.
 * Used as fallback when Mapbox Directions API fails.
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371 // Earth radius in km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2))
}

function toRad(deg) { return (deg * Math.PI) / 180 }

/**
 * Search for places using Mapbox Geocoding API v5.
 * Biased to Delhi NCR region.
 */
export async function searchPlaces(query) {
  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes('your_mapbox')) return []
  if (!query || query.length < 2) return []
  try {
    const bbox = '76.8,28.2,77.6,28.9' // Delhi NCR bounding box
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?bbox=${bbox}&limit=5&access_token=${MAPBOX_TOKEN}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return (data.features || []).map(f => ({
      place_name: f.place_name,
      address: f.place_name,
      lat: f.center[1],
      lng: f.center[0]
    }))
  } catch {
    return []
  }
}
