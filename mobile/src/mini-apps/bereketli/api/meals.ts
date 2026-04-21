import client from './client';
import type {MealListing, MealNearby, MealOrder} from '../types/models';

export async function getNearbyMeals(
  lat: number,
  lon: number,
  radius?: number,
): Promise<MealNearby[]> {
  const params: Record<string, unknown> = {lat, lon};
  if (radius) params.radius = radius;

  const {data} = await client.get<MealNearby[]>('/meals/nearby', {params});
  return data;
}

export async function getMeal(id: string): Promise<MealListing> {
  const {data} = await client.get<MealListing>(`/meals/${id}`);
  return data;
}

export async function orderMeal(
  listingId: string,
  portions?: number,
): Promise<MealOrder> {
  const {data} = await client.post<MealOrder>(`/meals/${listingId}/order`, {
    portions,
  });
  return data;
}

export async function getAllMeals(): Promise<MealNearby[]> {
  const {data} = await client.get<MealNearby[]>('/meals/all');
  return data;
}

export async function getMealOrders(): Promise<MealOrder[]> {
  const {data} = await client.get<MealOrder[]>('/meal-orders');
  return data;
}
