import client from './client';

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface TotpStatusResponse {
  enabled: boolean;
}

export interface TotpSetupResponse {
  secret: string;
  qr_uri: string;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await client.put('/auth/password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export async function getTotpStatus(): Promise<TotpStatusResponse> {
  const {data} = await client.get<TotpStatusResponse>('/auth/totp/status');
  return data;
}

export async function setupTotp(): Promise<TotpSetupResponse> {
  const {data} = await client.post<TotpSetupResponse>('/auth/totp/setup');
  return data;
}

export async function verifyTotp(code: string): Promise<void> {
  await client.post('/auth/totp/verify', {code});
}

export async function deleteAccount(): Promise<void> {
  await client.delete('/auth/account');
}

export async function updateProfile(name?: string, avatarUrl?: string): Promise<any> {
  const body: Record<string, string> = {};
  if (name) body.name = name;
  if (avatarUrl) body.avatar_url = avatarUrl;
  const {data} = await client.put('/auth/profile', body);
  return data;
}

export async function uploadAvatar(uri: string, type: string, fileName: string): Promise<string> {
  const formData = new FormData();
  formData.append('photo', {uri, type, name: fileName} as any);
  const {data} = await client.post<{url: string}>('/upload/avatar', formData, {
    headers: {'Content-Type': 'multipart/form-data'},
  });
  return data.url;
}
