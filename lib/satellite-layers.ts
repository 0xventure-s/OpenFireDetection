import { DetectionLayerKind } from '@/types';

export type DetectionLayerRole = 'early-detection' | 'confirmation' | 'risk' | 'assessment';
export type DetectionLayerStatus = 'active' | 'supporting' | 'planned';

export interface DetectionLayerDefinition {
  key: DetectionLayerKind;
  label: string;
  provider: string;
  sourceProduct?: string;
  role: DetectionLayerRole;
  status: DetectionLayerStatus;
  cadenceMinutes?: number;
  latencyMinutes?: number;
  resolutionMeters?: number;
  confirmsFire: boolean;
  notes: string;
}

export const FIRMS_POLAR_PRODUCTS = [
  'VIIRS_NOAA21_NRT',
  'VIIRS_NOAA20_NRT',
  'VIIRS_SNPP_NRT',
  'MODIS_NRT',
] as const;

export const FIRMS_GEOSTATIONARY_PRODUCTS = ['GOES_NRT'] as const;
export const FIRMS_RESTRICTED_PRODUCTS = ['LANDSAT_NRT'] as const;

export type FirmsProduct = (typeof FIRMS_POLAR_PRODUCTS)[number] | (typeof FIRMS_GEOSTATIONARY_PRODUCTS)[number];

export const FIRMS_PRODUCT_LAYER: Record<FirmsProduct, DetectionLayerKind> = {
  VIIRS_NOAA21_NRT: 'viirs-noaa21',
  VIIRS_NOAA20_NRT: 'viirs-noaa20',
  VIIRS_SNPP_NRT: 'viirs-snpp',
  MODIS_NRT: 'modis',
  GOES_NRT: 'firms-goes-nrt',
};

export const SATELLITE_LAYERS: DetectionLayerDefinition[] = [
  {
    key: 'goes-fdcf',
    label: 'GOES-19 ABI FDCF directo',
    provider: 'NOAA / Google Earth Engine / AWS Open Data',
    role: 'early-detection',
    status: 'active',
    cadenceMinutes: 10,
    latencyMinutes: 10,
    resolutionMeters: 2000,
    confirmsFire: false,
    notes: 'Capa temprana propia; crea o refuerza focos sin confirmar.',
  },
  {
    key: 'firms-goes-nrt',
    label: 'FIRMS GOES_NRT',
    provider: 'NASA FIRMS / NOAA ABI',
    sourceProduct: 'GOES_NRT',
    role: 'early-detection',
    status: 'active',
    cadenceMinutes: 10,
    latencyMinutes: 30,
    resolutionMeters: 2000,
    confirmsFire: false,
    notes: 'Geoestacionario público filtrado por FIRMS; refuerza GOES y ayuda cuando Earth Engine/S3 falla.',
  },
  {
    key: 'viirs-noaa21',
    label: 'VIIRS NOAA-21 NRT',
    provider: 'NASA FIRMS',
    sourceProduct: 'VIIRS_NOAA21_NRT',
    role: 'confirmation',
    status: 'active',
    latencyMinutes: 180,
    resolutionMeters: 375,
    confirmsFire: true,
    notes: 'Pasada polar de alta sensibilidad; excelente para focos chicos.',
  },
  {
    key: 'viirs-noaa20',
    label: 'VIIRS NOAA-20 NRT',
    provider: 'NASA FIRMS',
    sourceProduct: 'VIIRS_NOAA20_NRT',
    role: 'confirmation',
    status: 'active',
    latencyMinutes: 180,
    resolutionMeters: 375,
    confirmsFire: true,
    notes: 'Confirmación polar de 375 m.',
  },
  {
    key: 'viirs-snpp',
    label: 'VIIRS Suomi-NPP NRT',
    provider: 'NASA FIRMS',
    sourceProduct: 'VIIRS_SNPP_NRT',
    role: 'confirmation',
    status: 'active',
    latencyMinutes: 180,
    resolutionMeters: 375,
    confirmsFire: true,
    notes: 'Otra pasada polar VIIRS para aumentar cobertura diaria.',
  },
  {
    key: 'modis',
    label: 'MODIS Terra/Aqua NRT',
    provider: 'NASA FIRMS',
    sourceProduct: 'MODIS_NRT',
    role: 'confirmation',
    status: 'supporting',
    latencyMinutes: 180,
    resolutionMeters: 1000,
    confirmsFire: true,
    notes: 'Respaldo histórico y confirmación secundaria.',
  },
  {
    key: 'thermal-anomaly',
    label: 'Capa termica combinada',
    provider: 'GOES/FIRMS/Sentinel-3',
    role: 'early-detection',
    status: 'active',
    cadenceMinutes: 10,
    latencyMinutes: 30,
    resolutionMeters: 375,
    confirmsFire: false,
    notes: 'Agrega brillo, temperatura, FRP e intensidad normalizada para pintar calor sobre el mapa.',
  },
  {
    key: 'goes-glm-lightning',
    label: 'GOES-19 GLM rayos',
    provider: 'NOAA AWS Open Data',
    role: 'risk',
    status: 'supporting',
    cadenceMinutes: 0.33,
    latencyMinutes: 2,
    resolutionMeters: 10000,
    confirmsFire: false,
    notes: 'No detecta fuego; prioriza riesgo y posible ignición por rayos.',
  },
  {
    key: 'sentinel3-slstr',
    label: 'Sentinel-3 SLSTR FRP',
    provider: 'Copernicus / EUMETSAT',
    role: 'confirmation',
    status: 'supporting',
    latencyMinutes: 180,
    resolutionMeters: 1000,
    confirmsFire: true,
    notes: 'Tercera familia termica para validacion independiente; requiere EUMETSAT API o feed FRP preprocesado.',
  },
  {
    key: 'sentinel2-hls',
    label: 'Sentinel-2 HLS',
    provider: 'NASA IMPACT / Copernicus',
    role: 'assessment',
    status: 'supporting',
    latencyMinutes: 2880,
    resolutionMeters: 30,
    confirmsFire: false,
    notes: 'Perímetros, cicatriz quemada y evidencia visual; no es alerta temprana.',
  },
  {
    key: 'landsat-hls',
    label: 'Landsat 8/9 HLS',
    provider: 'NASA IMPACT / USGS',
    role: 'assessment',
    status: 'supporting',
    latencyMinutes: 2880,
    resolutionMeters: 30,
    confirmsFire: false,
    notes: 'Complemento de daño y perímetro posterior al evento.',
  },
  {
    key: 'landsat-nrt',
    label: 'Landsat LFTA NRT',
    provider: 'NASA FIRMS / USGS',
    sourceProduct: 'LANDSAT_NRT',
    role: 'confirmation',
    status: 'planned',
    latencyMinutes: 180,
    resolutionMeters: 30,
    confirmsFire: true,
    notes: 'Alta resolución térmica, pero FIRMS lo limita a Norteamérica; permanece desactivado fuera de esa cobertura.',
  },
  {
    key: 'camera-ai',
    label: 'Cámaras ópticas/térmicas + IA',
    provider: 'Integración local',
    role: 'early-detection',
    status: 'planned',
    cadenceMinutes: 1,
    latencyMinutes: 3,
    confirmsFire: false,
    notes: 'Capa terrestre para atacar fuegos chicos antes de que el satélite los resuelva.',
  },
];

export function getFirmsLayer(product: string): DetectionLayerKind | undefined {
  return FIRMS_PRODUCT_LAYER[product as FirmsProduct];
}

export function isFirmsGeostationaryProduct(product?: string): boolean {
  return Boolean(product && FIRMS_GEOSTATIONARY_PRODUCTS.includes(product as (typeof FIRMS_GEOSTATIONARY_PRODUCTS)[number]));
}

export function isFirmsPolarProduct(product?: string): boolean {
  return Boolean(product && FIRMS_POLAR_PRODUCTS.includes(product as (typeof FIRMS_POLAR_PRODUCTS)[number]));
}
