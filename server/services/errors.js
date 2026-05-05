export class AppError extends Error {
  constructor(message, status = 500, code = 'internal_error') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'conflict');
    this.name = 'ConflictError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation error') {
    super(message, 400, 'validation_error');
    this.name = 'ValidationError';
  }
}
