export function yamlString(value) {
  if (value === null || value === undefined) return 'null';
  return JSON.stringify(String(value));
}

export function yamlScalar(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return yamlString(value);
}

export function yamlInline(value, fallback = []) {
  const resolved = value === null || value === undefined ? fallback : value;
  return JSON.stringify(resolved);
}

export function yamlDurationMinutes(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return String(Number(value));
  }
  return 'null';
}
