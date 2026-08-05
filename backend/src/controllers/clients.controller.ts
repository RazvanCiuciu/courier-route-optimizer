import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as clientsRepo from "../repositories/clients.repo";
import { newClientSchema } from "../validation/schemas";
import { NotFoundError } from "../errors";

const idSchema = z.coerce.number().int().positive();

export async function create(req: Request, res: Response, next: NextFunction) {
    try {
        const data = newClientSchema.parse(req.body);
        const client = await clientsRepo.create(data);
        res.status(201).json(client);
    } catch (err) {
        next(err);
    }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
    try {
        const id = idSchema.parse(req.params.id);
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