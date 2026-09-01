import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ApiResponse, BBox, EarthquakeFeedResponse, LightningFlash, PrecipitationLayerMetadata, ProvinceWeatherForecast } from '@/types';

export interface LightningLayerResponse {
  flashes: LightningFlash[];
  count: number;
  bbox: BBox;
  status: 'active' | 'stale' | 'disabled';
  reason?: string;
  acquisitionTime?: string;
  cadence: string;
  maxFallbackMinutes: number;
  filesRead: number;
  source: string;
  role: 'risk';
}

export function useProvinceWeatherForecast(enabled = true) {
  return useQuery({
    queryKey: ['province-weather-forecast'],
    queryFn: async () => {
      const response = await axios.get<ApiResponse<ProvinceWeatherForecast>>('/api/fire/weather/forecast');
      return response.data.data as ProvinceWeatherForecast;
    },
    enabled,
    staleTime: 15 * 60 * 1000,
    refetchInterval: enabled ? 15 * 60 * 1000 : false,
    retry: 1,
  });
}

export function usePrecipitationLayer(enabled = true) {
  return useQuery({
    queryKey: ['precipitation-layer-metadata'],
    queryFn: async () => {
      const response = await axios.get<ApiResponse<PrecipitationLayerMetadata>>('/api/fire/weather/precipitation');
      return response.data.data as PrecipitationLayerMetadata;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchInterval: enabled ? 5 * 60 * 1000 : false,
    retry: 1,
  });
}

export function useLightningLayer(enabled = true) {
  return useQuery({
    queryKey: ['lightning-layer'],
    queryFn: async () => {
      const response = await axios.get<ApiResponse<LightningLayerResponse>>('/api/fire/lightning');
      return response.data.data as LightningLayerResponse;
    },
    enabled,
    staleTime: 60 * 1000,
    refetchInterval: enabled ? 60 * 1000 : false,
    retry: 1,
  });
}

export function useEarthquakes(enabled = true) {
  return useQuery({
    queryKey: ['jurisdiction-earthquakes'],
    queryFn: async () => {
      const response = await axios.get<ApiResponse<EarthquakeFeedResponse>>('/api/fire/earthquakes');
      return response.data.data as EarthquakeFeedResponse;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchInterval: enabled ? 5 * 60 * 1000 : false,
    retry: 1,
  });
}
