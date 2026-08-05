import type { Request, Response, NextFunction } from "express";
import * as ordersService from "../services/orders.service";

export async function create(req: Request, res: Response, next: NextFunction) {
    try {
        const order = await ordersService.createOrder(req.body);
        res.status(201).json(order);
    } catch (err) {
        next(err);
    }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number(req.params.id);
        const order = await ordersService.getOrderById(id);
        res.json(order);
    } catch (err) {
        next(err);
    }
}

export async function listByWeek(req: Request, res: Response, next: NextFunction) {
    try {
        const week = String(req.query.week);
        const orders = await ordersService.getOrdersForWeek(week);
        res.json(orders);
    } catch (err) {
        next(err);
    }
}

export async function changeStatus(req: Request, res: Response, next: NextFunction)
{
    try{
        const id = Number(req.params.id);
        const status = req.body.status;
        const dropReason = req.body.drop_reason ?? null;
        const order = await ordersService.changeStatus(id,status,dropReason);
        res.json(order);
    }catch(err){
        next(err);
    }
}

export async function assignDay(req: Request, res: Response, next: NextFunction)
{
    try{
        const id = Number(req.params.id);
        const day = req.body.day;
        const order = await ordersService.assignToDay(id,day);
        res.json(order); 
    }catch(err){
        next(err);
    }
}

export async function recordPayment(req: Request, res: Response, next: NextFunction)
{
    try{
        const id = Number(req.params.id);
        const cash = req.body.paid_cash;
        const transfer = req.body.paid_transfer;
        const order = await ordersService.recordPayment(id,cash,transfer);
        res.json(order); 
    }catch(err){
        next(err);
    }
}