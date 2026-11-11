// The only file that knows how requests are delivered. Today it runs the mock
// backend in the browser. To use a real server, replace the body of request()
// with a fetch() to your API (same method, path, JSON in, JSON out, ApiError on
// non-2xx) and nothing else in the app needs to change.
import { ApiError } from './errors';
import { routes } from './mock/handlers';
import { consumeFailure, getMockOptions } from './mock/options';

const compiled = routes.map(([method, pattern, handler]) => {
  const keys = [];
  const regex = new RegExp(
    '^' + pattern.replace(/:([a-z]+)/gi, (_, key) => (keys.push(key), '([^/]+)')) + '$',
  );
  return { method, regex, keys, handler };
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function execute(method, path, body) {
  await wait(getMockOptions().latencyMs);
  if (consumeFailure()) {
    throw new ApiError(503, 'service_unavailable', 'The service is temporarily unavailable.');
  }
  const [pathname, queryString = ''] = path.split('?');
  const query = Object.fromEntries(new URLSearchParams(queryString));
  for (const route of compiled) {
    if (route.method !== method) continue;
    const match = route.regex.exec(pathname);
    if (!match) continue;
    const params = Object.fromEntries(route.keys.map((key, i) => [key, decodeURIComponent(match[i + 1])]));
    // Round-trip through JSON so callers get plain data, as with a real response.
    const { body: result } = await route.handler({ params, body, query }); // handlers may be async (AI planner)
    return JSON.parse(JSON.stringify(result));
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
