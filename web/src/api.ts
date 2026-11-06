import type { BrewResult, Decisions, OrderId } from '../../shared/engine';

export interface BrewSummary {
  id: string;
  brewerName: string;
  sakeName: string;
  createdAt: string;
  score: number;
  rank: string;
  className: string;
  orderId: OrderId;
}

export interface BrewRecord extends BrewSummary {
  seed: number;
  decisions: Decisions;
  result: BrewResult;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // JSON 以外（ローカル開発で API がない場合など）
  }
  if (!res.ok || data === null) {
    const msg = (data as { message?: string } | null)?.message;
    throw new Error(msg ?? `記録サーバーに接続できませんでした（${res.status}）`);
  }
  return data as T;
}

export function listBrews(limit = 20) {
  return request<{ items: BrewSummary[] }>(`/api/brews?limit=${limit}`);
}

export function ranking() {
  return request<{ items: BrewSummary[] }>('/api/ranking');
}

export function getBrew(id: string) {
  return request<BrewRecord>(`/api/brews/${encodeURIComponent(id)}`);
}

export async function saveBrew(payload: { brewerName: string; sakeName: string; seed: number; decisions: Decisions }) {
  const body = JSON.stringify(payload);
  // CloudFront OAC 経由で Lambda Function URL に POST する場合、本文の SHA-256 が必要
  const hash = await sha256Hex(body);
  return request<BrewRecord>('/api/brews', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-amz-content-sha256': hash },
    body,
  });
}
