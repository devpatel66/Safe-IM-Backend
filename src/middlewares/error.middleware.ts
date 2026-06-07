import { NextFunction, Request, Response } from "express";

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error(err);

  const status = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? "Internal server error";

  res.status(status).json({
    success: false,
    message,
  });
};
