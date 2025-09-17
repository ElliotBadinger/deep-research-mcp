export class ResearchError extends Error {
  public cause?: Error;
  
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'ResearchError';
    this.cause = cause;
  }
}

export class SearchError extends ResearchError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'SearchError';
  }
}

export class AIModelError extends ResearchError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'AIModelError';
  }
}