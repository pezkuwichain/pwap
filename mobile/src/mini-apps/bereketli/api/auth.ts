import client, {saveTokens} from './client';
import type {AuthResponse, User} from '../types/models';

export async function register(
  name: string,
  email: string,
  password: string,
  phone?: string,
  referral_code?: string,
): Promise<AuthResponse> {
  const body: Record<string, string> = {name, email, password};
  if (phone) body.phone = phone;
  if (referral_code) body.referral_code = referral_code;
  const {data} = await client.post<AuthResponse>('/auth/register', body);
  await saveTokens(data.access_token, data.refresh_token);
  return data;
}

export async function login(
  identifier: string,
  password: string,
): Promise<AuthResponse> {
  const {data} = await client.post<AuthResponse>('/auth/login', {
    identifier,
    password,
  });
  await saveTokens(data.access_token, data.refresh_token);
  return data;
}

export async function getMe(): Promise<User> {
  const {data} = await client.get<User>('/auth/me');
  return data;
}

export async function refreshToken(refresh_token: string): Promise<AuthResponse> {
  const {data} = await client.post<AuthResponse>('/auth/refresh', {
    refresh_token,
  });
  await saveTokens(data.access_token, data.refresh_token);
  return data;
}
