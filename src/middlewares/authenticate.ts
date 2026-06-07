import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function authenticate(req: Request, res: Response, next: NextFunction) {
  // 1. Read the Authorization header
  //    The client must send: Authorization: Bearer eyJhbGci...
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }

  // 2. Extract the token — split "Bearer <token>" on the space
  const token = authHeader.split(" ")[1];

  try {
    // 3. Verify the signature AND check expiry in one call.
    //    If the token was tampered with → throws JsonWebTokenError
    //    If the token is expired        → throws TokenExpiredError
    //    If all good                    → returns the decoded payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      email: string;
      role: "admin" | "staff" | "viewer";
    };

    // 4. Attach to req so every downstream middleware and controller
    //    can read it without touching the DB again
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    // 5. Hand off to the next middleware or controller
    next();

  } catch (error: any) {
    // jwt.verify throws named errors — handle them separately
    // so the client knows WHY their token was rejected
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired — please log in again",
      });
    }

    // JsonWebTokenError covers: invalid signature, malformed token, wrong secret
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
}