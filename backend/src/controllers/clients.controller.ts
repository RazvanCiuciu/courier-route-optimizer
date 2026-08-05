import type { Request, Response, NextFunction } from "express";
import * as clientsRepo from "../repositories/clients.repo";
import { NotFoundError } from "../errors";

export async function create(req: Request, res: Response, next: NextFunction) {
    try {
        const client = await clientsRepo.create(req.body);
        res.status(201).json(client);
    } catch (err) {
        next(err);
    }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number(req.params.id);
        const client = await clientsRepo.findById(id);
        if (client === null) {
            throw new NotFoundError("Client", id);
        }
        res.json(client);
    } catch (err) {
        next(err);
    }
}

export async function listAll(_req: Request, res: Response, next: NextFunction) {
    try {
        const clients = await clientsRepo.findAll();
        res.json(clients);
    } catch (err) {
        next(err);
    }
}