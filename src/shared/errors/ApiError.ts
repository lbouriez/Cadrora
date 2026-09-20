export class ApiException extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, messageKey: string, status: number, options?: ErrorOptions) {
    super(messageKey, options);
    this.name = 'ApiException';
    this.code = code;
    this.status = status;
  }
}

