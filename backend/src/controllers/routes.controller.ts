import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as routingService from "../services/routing.service";
import * as stopsRepo from "../repositories/route_stops.repo";

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

const daySchema = z.enum(["thursday", "friday"]);

export async function dayStops(req: Request, res: Response, next: NextFunction) {
    try {
        const week = weekSchema.parse(req.query.week);
        const day = daySchema.parse(req.query.day);
        const stops = await stopsRepo.findDayStops(week, day);
        res.json(stops);
    } catch (err) {
        next(err);
    }
}

export async function reroute(req: Request, res: Response, next: NextFunction) {
    try {
        const week = weekSchema.parse(req.body.delivery_week);
        const day = daySchema.parse(req.body.day);
        const currentTime = z.number().int().min(0).max(1439).parse(req.body.current_time_min);

        const result = await routingService.rerouteRemaining(week, day, currentTime);
        await routingService.commitReroute(week, day, result);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function compare(req: Request, res: Response, next: NextFunction) {
    try {
        const week = weekSchema.parse(req.query.week);
        const day = daySchema.parse(req.query.day);
        const result = await routingService.compareMethods(week, day);
        res.json(result);
    } catch (err) {
        next(err);
    }
}