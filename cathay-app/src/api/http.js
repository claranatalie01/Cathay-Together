// The only file that knows how requests are delivered.
//   mock mode   (default) the pretend backend in src/api/mock, inside this browser
//   shared mode the real backend in src/api/shared, which talks to Supabase
// Both answer the same method + path with the same JSON (docs/api-contract.md) and
// throw ApiError on failure, so nothing else in the app needs to know which is in use.
import { isShared } from './config';
import { ApiError } from './errors';
import { routes as mockRoutes } from './mock/handlers';
import { consumeFailure, getMockOptions } from './mock/options';
import { routes as sharedRoutes } from './shared/handlers';

const compile = (routes) =>
  routes.map(([method, pattern, handler]) => {
    const keys = [];
    const regex = new RegExp(
      '^' + pattern.replace(/:([a-z]+)/gi, (_, key) => (keys.push(key), '([^/]+)')) + '$',
    );
    return { method, regex, keys, handler };
  });

const compiled = compile(isShared ? sharedRoutes : mockRoutes);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function execute(method, path, body) {
  if (!isShared) {
    // The mock pretends to be a network: a short delay and, on request, a failure.
    await wait(getMockOptions().latencyMs);
    if (consumeFailure()) {
      throw new ApiError(503, 'service_unavailable', 'The service is temporarily unavailable.');
    }
  }
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
  if (isShared) {
    // The endpoint exists in the contract but is not wired to Supabase yet.
    throw new ApiError(404, 'not_connected', 'This screen is not connected to the shared backend yet.');
  }
  throw new ApiError(404, 'not_found', `No route for ${method} ${path}.`);
}

// Identical GET requests made at the same time share one call (this also keeps
// React's development double-render from sending everything twice).
const inFlight = new Map();

export function request(method, path, body) {
  if (method !== 'GET') return execute(method, path, body);
  if (!inFlight.has(path)) {
    const call = execute(method, path).finally(() => inFlight.delete(path));
    inFlight.set(path, call);
  }
  return inFlight.get(path);
}
