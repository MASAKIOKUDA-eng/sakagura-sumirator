/**
 * Cognito マネージドログインによる認証（OAuth 2.0 認可コード + PKCE）。
 * パスワードはこのアプリを通らず、Cognito のログイン画面でのみ入力される。
 */

interface AuthConfig {
  authDomain: string;
  clientId: string;
}

interface Tokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  /** アクセストークンの有効期限（ミリ秒） */
  expiresAt: number;
}

const TOKEN_KEY = 'sakagura.auth';
const PKCE_KEY = 'sakagura.pkce';

let config: AuthConfig | null = null;
let tokens: Tokens | null = null;

const safe = {
  get(store: Storage | undefined, key: string): string | null {
    try {
      return store?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(store: Storage | undefined, key: string, value: string | null) {
    try {
      if (value === null) store?.removeItem(key);
      else store?.setItem(key, value);
    } catch {
      // ストレージが使えない環境ではページを開いている間だけ保持する
    }
  },
};

const local = () => (typeof localStorage === 'undefined' ? undefined : localStorage);
const session = () => (typeof sessionStorage === 'undefined' ? undefined : sessionStorage);

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(len = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(len)));
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = new TextDecoder().decode(Uint8Array.from(atob(part), (c) => c.charCodeAt(0)));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const redirectUri = () => `${location.origin}/`;

function saveTokens(t: Tokens | null) {
  tokens = t;
  safe.set(local(), TOKEN_KEY, t ? JSON.stringify(t) : null);
}

async function tokenRequest(params: Record<string, string>): Promise<Tokens> {
  const res = await fetch(`${config!.authDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config!.clientId, ...params }),
  });
  if (!res.ok) throw new Error(`token endpoint returned ${res.status}`);
  const data = (await res.json()) as { access_token: string; id_token: string; refresh_token?: string; expires_in: number };
  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token ?? params.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/** 起動時に呼ぶ。設定を読み込み、ログイン画面から戻ってきた場合はトークンを取得する */
export async function initAuth(): Promise<void> {
  try {
    const res = await fetch('/config.json', { cache: 'no-store' });
    const c = res.ok ? ((await res.json()) as Partial<AuthConfig>) : null;
    config = c?.authDomain && c.clientId ? { authDomain: c.authDomain.replace(/\/$/, ''), clientId: c.clientId } : null;
  } catch {
    config = null; // ローカル開発（npm run dev）では認証なし
  }
  if (!config) return;

  const raw = safe.get(local(), TOKEN_KEY);
  if (raw) {
    try {
      tokens = JSON.parse(raw) as Tokens;
    } catch {
      saveTokens(null);
    }
  }

  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code && !url.searchParams.get('error')) return;

  const pending = JSON.parse(safe.get(session(), PKCE_KEY) ?? 'null') as { verifier: string; state: string; returnHash: string } | null;
  safe.set(session(), PKCE_KEY, null);
  if (code && pending && state === pending.state) {
    try {
      saveTokens(await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: pending.verifier }));
    } catch (err) {
      console.error('ログインに失敗しました', err);
    }
  }
  // URL から認可コードを取り除き、ログイン前の画面に戻す
  history.replaceState(null, '', `/${pending?.returnHash ?? ''}`);
}

export function authEnabled(): boolean {
  return config !== null;
}

export function isLoggedIn(): boolean {
  return tokens !== null;
}

export function currentEmail(): string | null {
  if (!tokens) return null;
  const email = decodeJwt(tokens.idToken)?.email;
  return typeof email === 'string' ? email : null;
}

/** ログイン画面へ移動する。戻り先は現在の画面 */
export async function login(returnHash = location.hash): Promise<void> {
  if (!config) return;
  const verifier = randomString(48);
  const state = randomString(16);
  safe.set(session(), PKCE_KEY, JSON.stringify({ verifier, state, returnHash }));
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri(),
    scope: 'openid email',
    state,
    code_challenge_method: 'S256',
    code_challenge: await pkceChallenge(verifier),
    lang: 'ja',
  });
  location.assign(`${config.authDomain}/oauth2/authorize?${q}`);
}

export function logout(): void {
  saveTokens(null);
  if (!config) return;
  const q = new URLSearchParams({ client_id: config.clientId, logout_uri: redirectUri() });
  location.assign(`${config.authDomain}/logout?${q}`);
}

/** 有効なアクセストークン。期限切れならリフレッシュし、できなければログアウト状態にする */
export async function accessToken(): Promise<string | null> {
  if (!tokens || !config) return null;
  if (tokens.expiresAt - 60_000 > Date.now()) return tokens.accessToken;
  if (!tokens.refreshToken) {
    saveTokens(null);
    return null;
  }
  try {
    saveTokens(await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken }));
    return tokens!.accessToken;
  } catch {
    saveTokens(null);
    return null;
  }
}

/** API から 401 が返ったとき（トークン失効など）に呼ぶ */
export function forgetSession(): void {
  saveTokens(null);
}
