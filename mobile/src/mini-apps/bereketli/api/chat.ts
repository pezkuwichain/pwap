import client from './client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
}

export async function sendMessage(
  message: string,
  conversation: ChatMessage[],
): Promise<ChatResponse> {
  const {data} = await client.post<ChatResponse>('/chat', {
    message,
    conversation,
  });
  return data;
}
