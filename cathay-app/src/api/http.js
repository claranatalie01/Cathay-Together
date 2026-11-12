// Dispatch app requests to the Supabase-backed routes.
import { ApiError } from './errors';
import { routes as sharedRoutes } from './shared/handlers';

const compile = (routes) =>
  routes.map(([method, pattern, handler]) => {
    const keys = [];
    const regex = new RegExp(
      '^' + pattern.replace(/:([a-z]+)/gi, (_, key) => (keys.push(key), '([^/]+)')) + '$',
    );
    return { method, regex, keys, handler };
  });

const compiled = compile(sharedRoutes);

async function execute(method, path, body) {
  const [pathname, queryString = ''] = path.split('?');
  const query = Object.fromEntries(new URLSearchParams(queryString));
  for (const route of compiled) {
    if (route.method !== method) continue;
    const match = route.regex.exec(pathname);
    if (!match) continue;
    const params = Object.fromEntries(route.keys.map((key, i) => [key, decodeURIComponent(match[i + 1])]));
    const response = await route.handler({ params, body, query });
    // Round-trip through JSON so callers get plain data, as with a real response.
    return JSON.parse(JSON.stringify(response.body));
  }
  throw new ApiError(404, 'not_connected', 'This screen is not connected to the shared backend yet.');
}

// Identical GET requests made at the same time share one call (this also keeps
// React's development double-render from sending everything twice).
const inFlight = new Map();

export function invalidateGet(path) {
  inFlight.delete(path);
}

export function clearPendingGets() {
  inFlight.clear();
}

export function request(method, path, body) {
  if (method !== 'GET') return execute(method, path, body);
  if (!inFlight.has(path)) {
    const call = execute(method, path).finally(() => {
      if (inFlight.get(path) === call) inFlight.delete(path);
    });
    inFlight.set(path, call);
  }
  return inFlight.get(path);
}
