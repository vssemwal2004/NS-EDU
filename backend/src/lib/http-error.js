export class HttpError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export const notFound = (message = 'Not found') => new HttpError(404, message);
export const badRequest = (message, fields) => new HttpError(400, message, fields ? { fields } : {});
