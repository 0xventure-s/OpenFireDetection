// Map style configurations
export const MAP_STYLES = {
  // Satellite with labels (best for fire detection)
  satellite: {
    name: 'Satélite',
    url: 'https://api.maptiler.com/maps/hybrid/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
    description: 'Vista satelital con etiquetas'
  },

  // Terrain with relief
  terrain: {
    name: 'Terreno',
    url: 'https://api.maptiler.com/maps/outdoor/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
    description: 'Mapa topográfico con relieve'
  },

  // Street map (light)
  streets: {
    name: 'Calles',
    url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    description: 'Mapa de calles claro'
  },

  // Dark map
  dark: {
    name: 'Oscuro',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    description: 'Mapa oscuro'
  },

  // OpenStreetMap (fallback)
  osm: {
    name: 'OSM',
    url: 'https://demotiles.maplibre.org/style.json',
    description: 'OpenStreetMap básico'
  }
} as const;

// Get default map style
export function getDefaultMapStyle(): string {
  return process.env.NEXT_PUBLIC_MAP_STYLE || MAP_STYLES.streets.url;
}

// Custom satellite style using free sources
export const CUSTOM_SATELLITE_STYLE = {
  version: 8,
  name: 'Satellite Hybrid',
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics'
    },
    'carto-labels': {
      type: 'vector',
      tiles: [
        'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
      ]
    }
  },
  layers: [
    {
      id: 'satellite',
      type: 'raster',
      source: 'esri-satellite',
      minzoom: 0,
      maxzoom: 22
    }
  ]
};
