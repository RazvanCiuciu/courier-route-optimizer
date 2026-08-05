import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as stopsRepo from "../repositories/route_stops.repo";
import * as ordersService from "../services/orders.service";
import { stopUpdateSchema } from "../validation/schemas";
import { NotFoundError } from "../errors";

const idSchema = z.coerce.number().int().positive();

export async function updateStop(req: Request, res: Response, next: NextFunction) {
    try {
        const stopId = idSchema.parse(req.params.id);
        const data = stopUpdateSchema.parse(req.body);

        const stop = await stopsRepo.findById(stopId);
        if( stop === null){
            throw new NotFoundError("Route stop",stopId);
        }

        let order = await ordersService.changeStatus(
            stop.order_id,
            data.status,
            data.drop_reason ?? null
        );

        if (data.status === "delivered" && (data.paid_cash || data.paid_transfer)) {
            order = await ordersService.recordPayment(
                stop.order_id,
                data.paid_cash ?? "0",
                data.paid_transfer ?? "0"
            );
        }

        res.json(order);
    } catch (err) {
        next(err);
    }
}