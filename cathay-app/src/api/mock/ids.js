function slugify(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'group'
  );
}

export function uniqueGroupId(name, existingIds) {
  const base = slugify(name);
  let id = base;
  let n = 2;
  while (existingIds.includes(id)) id = `${base}-${n++}`;
  return id;
}

function codeFor(key) {
  let hash = 7;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash.toString(36).toUpperCase().padStart(6, 'X').slice(0, 6);
}

// Deterministic six-character code, including a fallback for collisions.
export function makeInviteCode(id, reserved) {
  let code = codeFor(id);
  for (let suffix = 2; reserved.has(code); suffix += 1) {
    code = codeFor(`${id}-${suffix}`);
  }
  return code;
}
