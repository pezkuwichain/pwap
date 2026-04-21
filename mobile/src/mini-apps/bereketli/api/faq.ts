import client from './client';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
}

export async function getFaqs(): Promise<FaqItem[]> {
  const {data} = await client.get<FaqItem[]>('/faq');
  return data;
}
