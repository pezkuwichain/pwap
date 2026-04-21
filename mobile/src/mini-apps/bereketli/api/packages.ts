import client from './client';
import type {Package, PackageNearby} from '../types/models';

export async function getNearbyPackages(
  lat: number,
  lon: number,
  radius?: number,
  category?: string,
  page?: number,
  perPage?: number,
): Promise<PackageNearby[]> {
  const params: Record<string, unknown> = {lat, lon};
  if (radius) params.radius = radius;
  if (category) params.category = category;
  if (page) params.page = page;
  if (perPage) params.per_page = perPage;

  const {data} = await client.get<PackageNearby[]>('/packages/nearby', {params});
  return data;
}

export async function getPackage(id: string): Promise<Package> {
  const {data} = await client.get<Package>(`/packages/${id}`);
  return data;
}

export async function getAllPackages(category?: string): Promise<PackageNearby[]> {
  const params: Record<string, unknown> = {};
  if (category) params.category = category;
  const {data} = await client.get<PackageNearby[]>('/packages/all', {params});
  return data;
}
