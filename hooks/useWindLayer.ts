import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ApiResponse, WindLayerResponse } from '@/types';

export function useWindLayer(enabled: boolean) {
  return useQuery({
    queryKey: ['wind-layer'],
    queryFn: async () => {
      const response = await axios.get<ApiResponse<WindLayerResponse>>('/api/fire/weather/wind');
      return response.data.data as WindLayerResponse;
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    refetchInterval: enabled ? 10 * 60 * 1000 : false,
    retry: 1,
  });
}
