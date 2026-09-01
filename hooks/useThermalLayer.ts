import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ApiResponse, BBox, ThermalAnomaly } from '@/types';

interface ThermalLayerResponse {
  anomalies: ThermalAnomaly[];
  count: number;
  status: 'active' | 'stale';
  bbox: BBox;
  generatedAt: string;
  sources: {
    goes: number;
    firms: number;
    sentinel3: number;
  };
  maxIntensity: number;
}

export function useThermalLayer(enabled: boolean) {
  return useQuery({
    queryKey: ['thermal-layer'],
    queryFn: async () => {
      const response = await axios.get<ApiResponse<ThermalLayerResponse>>('/api/fire/thermal');
      return response.data.data as ThermalLayerResponse;
    },
    enabled,
    refetchInterval: enabled ? 60000 : false,
    staleTime: 30000,
  });
}
