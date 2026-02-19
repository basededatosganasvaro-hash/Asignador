import { Request, Response, NextFunction } from "express";
import { config } from "../config";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-service-secret"] as string;
  if (!config.serviceSecret || secret !== config.serviceSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
