import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn();
const verify = vi.fn();
process.env.USER_POOL_ID = 'ap-northeast-1_test';
vi.mock('aws-jwt-verify', () => ({ CognitoJwtVerifier: { create: () => ({ verify }) } }));
vi.mock('@aws-sdk/lib-dynamodb', async (orig) => {
  const actual = await orig<typeof import('@aws-sdk/lib-dynamodb')>();
  return { ...actual, DynamoDBDocumentClient: { from: () => ({ send }) } };
});

const { handler, cleanText, newId } = await import('../api/handler');
import type { LambdaFunctionURLEvent } from 'aws-lambda';

const decisions = {
  veteran: 'koji',
  rice: 'gohyakumangoku',
  polish: 60,
  soak: 1,
  koji: 'tsukihaze',
  dekoji: 45,
  shubo: 'sokujo',
  yeast: 'k9',
  moromi: [0, 0, 0],
  pressTiming: 'standard',
  alcohol: 'none',
  press: 'yabuta',
  hiire: 'twice',
};

function event(
  method: string,
  rawPath: string,
  body?: unknown,
  query?: Record<string, string>,
  headers: Record<string, string> = {},
): LambdaFunctionURLEvent {
  return {
    rawPath,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    isBase64Encoded: false,
    queryStringParameters: query,
    requestContext: { http: { method } },
  } as unknown as LambdaFunctionURLEvent;
}

const AUTH = { 'x-auth-token': 'valid-token' };

beforeEach(() => {
  send.mockReset();
  verify.mockReset();
  verify.mockImplementation(async (t: string) => {
    if (t === 'valid-token') return { sub: 'user-123' };
    throw new Error('invalid token');
  });
});

describe('POST /api/brews', () => {
  it('サーバーで再計算した結果を保存する（クライアントのスコアは無視）', async () => {
    send.mockResolvedValue({});
    const res = await handler(
      event('POST', '/api/brews', { brewerName: ' 杜氏 ', sakeName: '初雪', seed: 99, decisions, result: { score: 100 } }, undefined, AUTH),
    );
    expect(res.statusCode).toBe(201);
    const [main, mine] = send.mock.calls[0][0].input.TransactItems.map((t: { Put: { Item: Record<string, unknown> } }) => t.Put.Item);
    expect(main.brewerName).toBe('杜氏');
    expect((main.result as { score: number }).score).toBe(main.score);
    expect(main.expiresAt).toBeGreaterThan(Date.now() / 1000);
    expect(main.userSub).toBe('user-123');
    expect(mine.pk).toBe('USER#user-123');
    expect(mine.sk).toBe(main.sk);
    expect(mine.decisions).toBeUndefined();
    const body = JSON.parse(res.body);
    expect(body.id).toBe(main.sk);
    expect(body.userSub).toBeUndefined();
  });

  it('ログインしていない・トークンが不正なら 401 で保存しない', async () => {
    const payload = { brewerName: 'a', sakeName: 'a', seed: 1, decisions };
    expect((await handler(event('POST', '/api/brews', payload))).statusCode).toBe(401);
    expect((await handler(event('POST', '/api/brews', payload, undefined, { 'x-auth-token': 'forged' }))).statusCode).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it('不正な入力は 400', async () => {
    const post = (b: unknown) => handler(event('POST', '/api/brews', b, undefined, AUTH));
    expect((await post({ brewerName: '', sakeName: 'a', seed: 1, decisions })).statusCode).toBe(400);
    expect((await post({ brewerName: 'a', sakeName: 'a', seed: 1.5, decisions })).statusCode).toBe(400);
    expect((await post({ brewerName: 'a', sakeName: 'a', seed: 1, decisions: { ...decisions, polish: 1 } })).statusCode).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('GET', () => {
  it('一覧は新しい順・件数上限 50', async () => {
    send.mockResolvedValue({ Items: [{ pk: 'BREW', sk: 'x', score: 1 }] });
    const res = await handler(event('GET', '/api/brews', undefined, { limit: '999' }));
    expect(res.statusCode).toBe(200);
    const input = send.mock.calls[0][0].input;
    expect(input.Limit).toBe(50);
    expect(input.ScanIndexForward).toBe(false);
    expect(JSON.parse(res.body).items[0]).toEqual({ id: 'x', score: 1 });
  });

  it('番付はスコア順に 10 件', async () => {
    send.mockResolvedValue({ Items: Array.from({ length: 15 }, (_, i) => ({ sk: `id${i}`, score: i })) });
    const res = await handler(event('GET', '/api/ranking'));
    const items = JSON.parse(res.body).items;
    expect(items).toHaveLength(10);
    expect(items[0].score).toBe(14);
  });

  it('不正な ID は DynamoDB を呼ばずに 404', async () => {
    const res = await handler(event('GET', '/api/brews/../../etc'));
    expect(res.statusCode).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it('自分の記録はログイン必須で、利用者のパーティションだけを読みキャッシュさせない', async () => {
    expect((await handler(event('GET', '/api/me/brews'))).statusCode).toBe(401);
    expect(send).not.toHaveBeenCalled();
    send.mockResolvedValue({ Items: [{ pk: 'USER#user-123', sk: 'x', score: 5 }] });
    const res = await handler(event('GET', '/api/me/brews', undefined, undefined, AUTH));
    expect(res.statusCode).toBe(200);
    expect(send.mock.calls[0][0].input.ExpressionAttributeValues[':pk']).toBe('USER#user-123');
    expect(res.headers?.['cache-control']).toBe('no-store');
  });

  it('未知のパスは 404', async () => {
    expect((await handler(event('DELETE', '/api/brews'))).statusCode).toBe(404);
  });
});

describe('helpers', () => {
  it('cleanText は制御文字を除き長さを検証する', () => {
    expect(cleanText('a\u0000b', 5)).toBe('ab');
    expect(cleanText('   ', 5)).toBeNull();
    expect(cleanText('あいうえおか', 5)).toBeNull();
    expect(cleanText(1, 5)).toBeNull();
  });
  it('newId は時刻順に並ぶ', () => {
    expect(newId(1000) < newId(2000)).toBe(true);
    expect(newId()).toMatch(/^[0-9a-z]{9}-[0-9a-z]{6}$/);
  });
});
