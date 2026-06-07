import { Request, Response, NextFunction } from "express";

/**
 * Custom request logger middleware.
 * Logs the timestamp, method, url, status code, and response time in milliseconds.
 */
export function loggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    // Colorize status codes for better visibility
    let statusColor = "\x1b[32m"; // Green for 2xx
    if (statusCode >= 500) {
      statusColor = "\x1b[31m"; // Red for 5xx
    } else if (statusCode >= 400) {
      statusColor = "\x1b[35m"; // Magenta for 4xx
    } else if (statusCode >= 300) {
      statusColor = "\x1b[33m"; // Yellow for 3xx
    }
    
    const resetColor = "\x1b[0m";
    const timestamp = new Date().toISOString();

    console.log(
      `[${timestamp}] ${method} ${originalUrl} -> ${statusColor}${statusCode}${resetColor} (${duration}ms)`
    );
  });

  next();
}
