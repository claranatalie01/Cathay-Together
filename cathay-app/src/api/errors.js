// Error thrown by every API call. `status` is the HTTP status, `code` a stable
// machine-readable string (see docs/api-contract.md) and `fields` an optional
// map of field name to message for validation errors (422).
export class ApiError extends Error {
  constructor(status, code, message, fields = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
