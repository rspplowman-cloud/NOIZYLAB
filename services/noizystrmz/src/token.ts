// Join tokens: base64url(JSON payload) + "." + base64url(HMAC-SHA256). Issued by a trusted service, never by a peer.
export interface JoinClaims { room: string; peer: string; exp: number; }

const enc = new TextEncoder();
const b64u = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

async function key(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function sign(claims: JoinClaims, secret: string): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify(claims)));
  const mac = await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body));
  return `${body}.${b64u(mac)}`;
}

export async function verify(token: string, secret: string, now = Date.now()): Promise<JoinClaims | null> {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", await key(secret), unb64u(mac), enc.encode(body)); } catch { return null; }
  if (!ok) return null;
  try {
    const c = JSON.parse(new TextDecoder().decode(unb64u(body))) as JoinClaims;
    if (typeof c.room !== "string" || typeof c.peer !== "string" || typeof c.exp !== "number") return null;
    return c.exp * 1000 > now ? c : null;
  } catch { return null; }
}
