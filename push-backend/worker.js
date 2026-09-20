const PROJECT_ID = "padel-app-9e144";
const ALLOWED_ORIGINS = new Set(["https://padelplayers.github.io"]);

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://padelplayers.github.io",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) } });
}
function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const raw = atob(s);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
function b64urlJson(s) { return JSON.parse(new TextDecoder().decode(b64urlToBytes(s))); }

let jwkCache = { expires: 0, keys: null };
async function googleJwks() {
  if (jwkCache.keys && Date.now() < jwkCache.expires) return jwkCache.keys;
  const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  if (!r.ok) throw new Error("firebase_jwks");
  const data = await r.json();
  const keys = Object.fromEntries((data.keys || []).filter(k => k.kid).map(k => [k.kid, k]));
  const cc = r.headers.get("cache-control") || "";
  const m = cc.match(/max-age=(\d+)/);
  jwkCache = { keys, expires: Date.now() + (m ? Number(m[1]) : 1800) * 1000 };
  return keys;
}
async function verifyFirebaseIdToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("token_format");
  const header = b64urlJson(parts[0]);
  const payload = b64urlJson(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("token_header");
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== PROJECT_ID || payload.iss !== `https://securetoken.google.com/${PROJECT_ID}` || !payload.sub || payload.exp <= now || payload.iat > now + 60) throw new Error("token_claims");
  const jwk = (await googleJwks())[header.kid];
  if (!jwk) throw new Error("token_kid");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, b64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw new Error("token_signature");
  return payload;
}
function fv(v) {
  if (!v) return null;
  if (Object.prototype.hasOwnProperty.call(v, "stringValue")) return v.stringValue;
  if (Object.prototype.hasOwnProperty.call(v, "booleanValue")) return v.booleanValue;
  if (Object.prototype.hasOwnProperty.call(v, "integerValue")) return Number(v.integerValue);
  if (Object.prototype.hasOwnProperty.call(v, "doubleValue")) return Number(v.doubleValue);
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(fv);
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k,val]) => [k,fv(val)]));
  return null;
}
function docData(doc) { return Object.fromEntries(Object.entries((doc && doc.fields) || {}).map(([k,v]) => [k,fv(v)])); }
async function firestoreGet(path, token) {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`firestore_${r.status}`);
  return docData(await r.json());
}
async function firestoreListUserUids(token) {
  const uids = [];
  let pageToken = "";
  do {
    const q = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/usuarios`);
    q.searchParams.set("pageSize", "300");
    if (pageToken) q.searchParams.set("pageToken", pageToken);
    const r = await fetch(q.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`firestore_users_${r.status}`);
    const data = await r.json();
    for (const doc of data.documents || []) {
      const name = String(doc.name || "");
      const uid = decodeURIComponent(name.slice(name.lastIndexOf("/") + 1));
      if (uid) uids.push(uid);
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return [...new Set(uids)];
}
async function idempotencyUuid(seed) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(seed))));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = [...bytes.slice(0,16)].map(b => b.toString(16).padStart(2,"0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}
async function sendOneSignal(env, uids, title, message, url, data, dedupeSeed) {
  const recipients = [...new Set((uids || []).filter(Boolean))];
  if (!recipients.length) return { skipped: true };
  const body = {
    app_id: env.ONESIGNAL_APP_ID,
    include_aliases: { external_id: recipients },
    target_channel: "push",
    headings: { es: title || "Pádel Players Morvedre", en: title || "Pádel Players Morvedre" },
    contents: { es: message || "Tienes un nuevo aviso", en: message || "Tienes un nuevo aviso" },
    url: url || "https://padelplayers.github.io/p-del-app/",
    data: data || {}
  };
  if (dedupeSeed) body.idempotency_key = await idempotencyUuid(dedupeSeed);
  const r = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: { Authorization: `Key ${env.ONESIGNAL_REST_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`onesignal_${r.status}_${JSON.stringify(out).slice(0,200)}`);
  return out;
}
function participantesPartida(p) { return [...new Set([...(Array.isArray(p.jugadores)?p.jugadores:[]), ...(Array.isArray(p.reservas)?p.reservas:[])].filter(Boolean))]; }

async function handleChat(env, body, token, uid) {
  const chatId = String(body.chatId || "");
  const messageId = String(body.messageId || "");
  const tipo = String(body.tipo || "");
  if (!chatId || !messageId || !["partida","privado"].includes(tipo)) throw new Error("chat_request");
  if (tipo === "partida") {
    const partida = await firestoreGet(`partidas/${encodeURIComponent(chatId)}`, token);
    const miembros = participantesPartida(partida);
    if (!miembros.includes(uid)) throw new Error("not_participant");
    const msg = await firestoreGet(`partidas/${encodeURIComponent(chatId)}/mensajes/${encodeURIComponent(messageId)}`, token);
    if (msg.u !== uid || msg.pushSolicitado !== true || msg.pushTipo !== "chat_partida") throw new Error("invalid_message");
    return sendOneSignal(env, miembros.filter(x => x !== uid), `Mensaje de ${msg.n || "un jugador"}`, msg.t || "Nuevo mensaje en una partida", `https://padelplayers.github.io/p-del-app/?chat=partida&partidaId=${encodeURIComponent(chatId)}`, {tipo:"chat_partida",chatId,messageId}, `chat_partida:${chatId}:${messageId}`);
  }
  const privado = await firestoreGet(`chatsPrivados/${encodeURIComponent(chatId)}`, token);
  const participantes = Array.isArray(privado.participantes) ? privado.participantes : [];
  if (!participantes.includes(uid)) throw new Error("not_participant");
  const msg = await firestoreGet(`chatsPrivados/${encodeURIComponent(chatId)}/mensajes/${encodeURIComponent(messageId)}`, token);
  if (msg.u !== uid || msg.pushSolicitado !== true || msg.pushTipo !== "chat_privado") throw new Error("invalid_message");
  return sendOneSignal(env, participantes.filter(x => x !== uid), `Mensaje privado de ${msg.n || "un jugador"}`, msg.t || "Tienes un nuevo mensaje privado", `https://padelplayers.github.io/p-del-app/?chat=privado&chatId=${encodeURIComponent(chatId)}`, {tipo:"chat_privado",chatId,messageId}, `chat_privado:${chatId}:${messageId}`);
}
async function handleNotification(env, body, token, uid) {
  const id = String(body.notificationId || "");
  if (!id) throw new Error("notification_request");
  const n = await firestoreGet(`notificaciones/${encodeURIComponent(id)}`, token);
  if (n.pushSolicitado !== true || !n.uid || !n.partidaId) throw new Error("notification_not_pushable");
  if (n.uid === uid) return { skipped:true, reason:"self" };
  const partida = await firestoreGet(`partidas/${encodeURIComponent(n.partidaId)}`, token);
  const miembros = participantesPartida(partida);
  if (!miembros.includes(uid) || !miembros.includes(n.uid)) throw new Error("notification_not_authorized");
  return sendOneSignal(env, [n.uid], n.titulo || "Pádel Players Morvedre", n.mensaje || "Tienes un nuevo aviso de partida", `https://padelplayers.github.io/p-del-app/?partidaId=${encodeURIComponent(n.partidaId)}`, {tipo:n.tipo||"aviso",partidaId:n.partidaId,notificationId:id}, `notification:${id}`);
}
async function handleSystem(env, body, token, uid) {
  const partidaId = String(body.partidaId || "");
  const messageId = String(body.messageId || "");
  const eventType = String(body.eventType || "");
  const permitidos = new Set(["partida_creada","falta_1","falta_1_hombre","falta_1_mujer","plaza_libre_confirmada","sustitucion_urgente"]);
  if (!partidaId || !messageId || !permitidos.has(eventType)) throw new Error("system_request");
  const partida = await firestoreGet(`partidas/${encodeURIComponent(partidaId)}`, token);
  const creador = partida.creadaPor || partida.creador || null;
  const miembros = participantesPartida(partida);
  if (eventType === "partida_creada") {
    if (creador !== uid) throw new Error("system_not_authorized");
  } else if (!miembros.includes(uid) && creador !== uid) {
    throw new Error("system_not_authorized");
  }
  const msg = await firestoreGet(`chats/general/mensajes/${encodeURIComponent(messageId)}`, token);
  if (msg.system !== true || msg.valid !== true || msg.partidaId !== partidaId || msg.eventType !== eventType) throw new Error("invalid_system_message");
  const todos = await firestoreListUserUids(token);
  const destinatarios = todos.filter(x => x !== uid);
  const titulo = eventType === "partida_creada" ? "Nueva partida disponible" : (eventType === "sustitucion_urgente" ? "Se busca sustituto" : "Se busca jugador");
  return sendOneSignal(env, destinatarios, titulo, msg.t || "Hay una partida que necesita jugador", `https://padelplayers.github.io/p-del-app/?partidaId=${encodeURIComponent(partidaId)}`, {tipo:"sistema_partida",eventType,partidaId,messageId}, `system:${messageId}`);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, {status:204, headers:cors(origin)});
    if (request.method === "GET") return new Response("Padel Players Morvedre Push Backend OK", {headers:{"Content-Type":"text/plain; charset=utf-8"}});
    if (request.method !== "POST" || !ALLOWED_ORIGINS.has(origin)) return json({ok:false,error:"forbidden"},403,origin);
    try {
      const auth = request.headers.get("Authorization") || "";
      if (!auth.startsWith("Bearer ")) return json({ok:false,error:"unauthorized"},401,origin);
      const token = auth.slice(7);
      const claims = await verifyFirebaseIdToken(token);
      const body = await request.json();
      let result;
      if (body.action === "chat") result = await handleChat(env, body, token, claims.sub);
      else if (body.action === "notification") result = await handleNotification(env, body, token, claims.sub);
      else if (body.action === "system") result = await handleSystem(env, body, token, claims.sub);
      else return json({ok:false,error:"bad_action"},400,origin);
      return json({ok:true,result},200,origin);
    } catch (e) {
      console.log("push_error", e && e.message ? e.message : String(e));
      return json({ok:false,error:"request_rejected"},400,origin);
    }
  }
};
