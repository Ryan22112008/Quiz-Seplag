const isProduction = import.meta.env.PROD;
const configuredApiUrl = import.meta.env.VITE_API_URL;
const isLoopbackHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/gu, '');
  return normalized === 'localhost' || normalized.endsWith('.localhost') || normalized === '::1' || normalized.startsWith('127.');
};

if (isProduction && !configuredApiUrl) {
  throw new Error('VITE_API_URL precisa ser configurada para o build de produção.');
}

export const API_BASE_URL = (configuredApiUrl ?? 'http://localhost:3000').replace(/\/$/u, '');

let apiUrl: URL;
try { apiUrl = new URL(API_BASE_URL); }
catch { throw new Error('VITE_API_URL deve ser uma URL absoluta válida.'); }
if (!['http:', 'https:'].includes(apiUrl.protocol)) throw new Error('VITE_API_URL deve usar HTTP ou HTTPS.');
if (isProduction && (apiUrl.protocol !== 'https:' || isLoopbackHostname(apiUrl.hostname))) {
  throw new Error('VITE_API_URL deve usar HTTPS e um domínio público em produção.');
}

const configuredWsUrl = import.meta.env.VITE_WS_URL;
export const WS_BASE_URL = configuredWsUrl ?? `${API_BASE_URL.replace(/^http/u, 'ws')}/realtime`;
let wsUrl: URL;
try { wsUrl = new URL(WS_BASE_URL); }
catch { throw new Error('VITE_WS_URL deve ser uma URL absoluta válida.'); }
if (!['ws:', 'wss:'].includes(wsUrl.protocol)) throw new Error('VITE_WS_URL deve usar WS ou WSS.');
if (isProduction && (wsUrl.protocol !== 'wss:' || isLoopbackHostname(wsUrl.hostname))) {
  throw new Error('VITE_WS_URL deve usar WSS e um domínio público em produção.');
}
