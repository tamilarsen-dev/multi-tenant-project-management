declare global {
  namespace Express {
    /** Set by the authenticate middleware; never from client input. */
    interface AuthContext {
      user: { id: string; email: string; displayName: string; createdAt: Date };
      sessionId: string;
    }

    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
