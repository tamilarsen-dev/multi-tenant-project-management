declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      displayName: string;
    }

    interface Request {
      user?: User;
      sessionId?: string;
    }
  }
}

export {};
