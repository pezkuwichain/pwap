import client from './client';
import type {LoyaltyCard, LoyaltyProgram, Merchant, MerchantNearby} from '../types/models';

export async function getNearbyMerchants(
  lat: number,
  lon: number,
  radius?: number,
  category?: string,
): Promise<MerchantNearby[]> {
  const params: Record<string, unknown> = {lat, lon};
  if (radius) params.radius = radius;
  if (category) params.category = category;

  const {data} = await client.get<MerchantNearby[]>('/merchants/nearby', {params});
  return data;
}

export async function getAllMerchants(): Promise<MerchantNearby[]> {
  const {data} = await client.get<MerchantNearby[]>('/merchants/all');
  return data;
}

export async function getMerchant(id: string): Promise<{merchant: Merchant; programs: LoyaltyProgram[]}> {
  const {data} = await client.get(`/merchants/${id}`);
  return data;
}

export async function addStamp(
  programId: string,
  customerUserId: string,
  amount?: number,
) {
  const {data} = await client.post('/loyalty/stamp', {
    program_id: programId,
    customer_user_id: customerUserId,
    amount,
  });
  return data;
}

export async function getMyCards(): Promise<LoyaltyCard[]> {
  const {data} = await client.get<LoyaltyCard[]>('/loyalty/my-cards');
  return data;
}

export async function redeemReward(cardId: string) {
  const {data} = await client.post(`/loyalty/redeem/${cardId}`, {});
  return data;
}

// ── Merchant Products/Services ──

export interface MerchantProduct {
  id: string;
  merchant_id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  category: string | null;
  photo_url: string | null;
  available: boolean;
  sort_order: number;
}

export async function getMerchantProducts(merchantId: string): Promise<MerchantProduct[]> {
  const {data} = await client.get<MerchantProduct[]>(`/merchants/${merchantId}/products`);
  return data;
}

// ── Merchant Packages ──

export interface MerchantPackage {
  id: string;
  merchant_id: string;
  title: string;
  description: string | null;
  price: number;
  original_value: number;
  total_quantity: number;
  remaining: number;
  pickup_start: string;
  pickup_end: string;
  status: string;
}

export async function getMerchantPackages(merchantId: string): Promise<MerchantPackage[]> {
  const {data} = await client.get<MerchantPackage[]>(`/merchants/${merchantId}/packages`);
  return data;
}

// ── Appointments ──

export interface Appointment {
  id: string;
  merchant_id: string;
  customer_id: string;
  merchant_name: string;
  customer_name: string;
  service_name: string;
  appointment_date: string;
  time_slot: string;
  duration_minutes: number;
  price: number | null;
  status: string;
  notes: string | null;
}

export async function bookAppointment(
  merchantId: string,
  serviceName: string,
  date: string,
  timeSlot: string,
  notes?: string,
): Promise<Appointment> {
  const {data} = await client.post<Appointment>(`/merchants/${merchantId}/appointments`, {
    service_name: serviceName,
    appointment_date: date,
    time_slot: timeSlot,
    notes,
  });
  return data;
}

export async function getMyAppointments(): Promise<Appointment[]> {
  const {data} = await client.get<Appointment[]>('/appointments/mine');
  return data;
}

export async function cancelAppointment(id: string): Promise<Appointment> {
  const {data} = await client.put<Appointment>(`/appointments/${id}/cancel`);
  return data;
}

// ── Merchant Package Orders ──

export async function orderMerchantPackage(
  merchantId: string,
  packageId: string,
  quantity?: number,
): Promise<{id: string; total_price: number; qr_token: string}> {
  const {data} = await client.post(`/merchants/${merchantId}/packages/${packageId}/order`, {
    quantity,
  });
  return data;
}
