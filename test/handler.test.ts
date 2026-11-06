import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn();
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

function event(method: string, rawPath: string, body?: unknown, query?: Record<string, string>): LambdaFunctionURLEvent {
  return {
    rawPath,
    body: body === undefined ? undefined : JSON.stringify(body),
    isBase64Encoded: false,
    queryStringParameters: query,
    requestContext: { http: { method } },
  } as unknown as LambdaFunctionURLEvent;
}

beforeEach(() => send.mockReset());

describe('POST /api/brews', () => {
  it('サーバーで再計算した結果を保存する（クライアントのスコアは無視）', async () => {
    send.mockResolvedValue({});
    const res = await handler(
      event('POST', '/api/brews', { brewerName: ' 杜氏 ', sakeName: '初雪', seed: 99, decisions, result: { score: 100 } }),
    );
    expect(res.statusCode).toBe(201);
    const item = send.mock.calls[0][0].input.Item;
    expect(item.brewerName).toBe('杜氏');
    expect(item.result.score).toBe(item.score);
    expect(item.expiresAt).toBeGreaterThan(Date.now() / 1000);
    expect(JSON.parse(res.body).id).toBe(item.sk);
  });

  it('不正な入力は 400', async () => {
    expect((await handler(event('POST', '/api/brews', { brewerName: '', sakeName: 'a', seed: 1, decisions }))).statusCode).toBe(400);
    expect((await handler(event('POST', '/api/brews', { brewerName: 'a', sakeName: 'a', seed: 1.5, decisions }))).statusCode).toBe(400);
    expect(
      (await handler(event('POST', '/api/brews', { brewerName: 'a', sakeName: 'a', seed: 1, decisions: { ...decisions, polish: 1 } }))).statusCode,
    ).toBe(400);
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
