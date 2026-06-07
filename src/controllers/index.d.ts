export {};

interface AuthUser {
  id: number;
  email: string;
  role: "admin" | "staff" | "viewer";
}

declare global {
  namespace Express {
    export interface Request {
      user?: AuthUser;
    }
  }
}