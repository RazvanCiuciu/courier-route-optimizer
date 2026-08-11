import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as routingService from "../services/routing.service";

const weekSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export async function preview(req: Request, res: Response, next: NextFunction) {
    try {
        const week = weekSchema.parse(req.body.delivery_week);
        const result = await routingService.previewRoutes(week);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function commit(req: Request, res: Response, next: NextFunction) {
    try {
        const week = weekSchema.parse(req.body.delivery_week);
        const result = await routingService.previewRoutes(week);
        await routingService.commitRoutes(result);
        res.json(result);
    } catch (err) {
        next(err);
    }
}