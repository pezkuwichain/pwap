import client from './client';
import type {Review} from '../types/models';

export async function getReviews(
  targetType: 'store' | 'meal' | 'merchant',
  targetId: string,
  page?: number,
  perPage?: number,
): Promise<Review[]> {
  const params: Record<string, unknown> = {target_type: targetType, target_id: targetId};
  if (page) params.page = page;
  if (perPage) params.per_page = perPage;

  const {data} = await client.get<Review[]>('/reviews', {params});
  return data;
}

export async function createReview(
  targetType: 'store' | 'meal' | 'merchant',
  targetId: string,
  rating: number,
  comment?: string,
  orderId?: string,
): Promise<Review> {
  const body: Record<string, unknown> = {
    target_type: targetType,
    target_id: targetId,
    rating,
  };
  if (comment) body.comment = comment;
  if (orderId) body.order_id = orderId;

  const {data} = await client.post<Review>('/reviews', body);
  return data;
}
