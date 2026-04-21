import client from './client';
import type {PackageNearby} from '../types/models';

export async function searchPackages(query: string): Promise<PackageNearby[]> {
  const {data} = await client.get<PackageNearby[]>('/search', {params: {q: query}});
  return data;
}
