import client from './client';
import type {Order} from '../types/models';

export interface CreateOrderRequest {
  package_id: string;
  quantity?: number;
  delivery_type?: 'pickup' | 'delivery';
  delivery_address?: string;
}

export async function createOrder(
  packageId: string,
  quantity?: number,
  deliveryType?: 'pickup' | 'delivery',
  deliveryAddress?: string,
): Promise<Order> {
  const body: CreateOrderRequest = {
    package_id: packageId,
    quantity,
  };
  if (deliveryType) body.delivery_type = deliveryType;
  if (deliveryAddress) body.delivery_address = deliveryAddress;

  const {data} = await client.post<any>('/orders', body);
  // Backend returns {needs_payment, order} or plain Order
  return data.order || data;
}

export async function getOrders(page?: number, perPage?: number): Promise<Order[]> {
  const params: Record<string, unknown> = {};
  if (page) params.page = page;
  if (perPage) params.per_page = perPage;

  const {data} = await client.get<Order[]>('/orders', {params});
  return data;
}

export async function getOrder(id: string): Promise<Order> {
  const {data} = await client.get<Order>(`/orders/${id}`);
  return data;
}

export async function cancelOrder(id: string): Promise<Order> {
  const {data} = await client.put<Order>(`/orders/${id}/cancel`);
  return data;
}

export async function updateDeliveryStatus(
  orderId: string,
  status: 'preparing' | 'on_the_way' | 'delivered',
): Promise<Order> {
  const {data} = await client.put<Order>(`/orders/${orderId}/delivery-status`, {
    status,
  });
  return data;
}

export async function confirmPickup(
  orderId: string,
  qrToken: string,
): Promise<Order> {
  const {data} = await client.post<Order>(`/orders/${orderId}/confirm`, {
    qr_token: qrToken,
  });
  return data;
}
