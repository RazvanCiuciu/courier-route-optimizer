import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as ordersService from "../services/orders.service";
import {newOrderSchema, changeStatusSchema, assignDaySchema, paymentSchema} from "../validation/schemas";

const weekSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const idSchema = z.coerce.number().int().positive();

export async function create(req: Request, res: Response, next: NextFunction) {
    try {
        const data = newOrderSchema.parse(req.body);
        const order = await ordersService.createOrder(data);
        res.status(201).json(order);
    } catch (err) {
        next(err);
    }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
    try {
        const id = idSchema.parse(req.params.id);
        const order = await ordersService.getOrderById(id);
        res.json(order);
    } catch (err) {
        next(err);
    }
}

export async function listByWeek(req: Request, res: Response, next: NextFunction) {
    try {
        const week = weekSchema.parse(req.query.week);
        const orders = await ordersService.getOrdersForWeek(week);
        res.json(orders);
    } catch (err) {
        next(err);
    }
}

export async function changeStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const id = idSchema.parse(req.params.id);
        const { status, drop_reason } = changeStatusSchema.parse(req.body);
        const order = await ordersService.changeStatus(id, status, drop_reason ?? null);
        res.json(order);
    } catch (err) {
        next(err);
    }
}

export async function assignDay(req: Request, res: Response, next: NextFunction) {
    try {
        const id = idSchema.parse(req.params.id);
        const { day } = assignDaySchema.parse(req.body);
        const order = await ordersService.assignToDay(id, day);
        res.json(order);
    } catch (err) {
        next(err);
    }
}

export async function recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
        const id = idSchema.parse(req.params.id);
        const { paid_cash, paid_transfer } = paymentSchema.parse(req.body);
        const order = await ordersService.recordPayment(id, paid_cash, paid_transfer);
        res.json(order);
    } catch (err) {
        next(err);
    }
}

import { rescheduleSchema } from "../validation/schemas";

export async function reschedule(req: Request, res: Response, next: NextFunction) {
    try {
        const id = idSchema.parse(req.params.id);
        const { time_windows } = rescheduleSchema.parse(req.body);
        const order = await ordersService.rescheduleOrder(id, time_windows);
        res.json(order);
    } catch (err) {
        next(err);
    }
}