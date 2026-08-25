import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as clientsRepo from "../repositories/clients.repo";
import { newClientSchema, updateClientSchema } from "../validation/schemas";
import { NotFoundError } from "../errors";
import { ensureCoordinates } from "../services/geocoding.service";
import { geocode } from "../services/geocoding.service";

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

export async function geocodeClient(req: Request, res: Response, next: NextFunction) {
    try {
        const id = idSchema.parse(req.params.id);
        const client = await clientsRepo.findById(id);
        if (client === null) throw new NotFoundError("Client", id);
        const coords = await ensureCoordinates(client);
        res.json(coords);
    } catch (err) {
        next(err);
    }
}

const addressCheckSchema = z.object({
    address: z.string().min(1),
});

export async function checkAddress(req: Request, res: Response, next: NextFunction) {
    try {
        const { address } = addressCheckSchema.parse(req.body);
        try {
            const coords = await geocode(address);
            res.json({ found: true, ...coords });
        } catch {
            res.json({ found: false });
        }
    } catch (err) {
        next(err);
    }
}

export async function update(req: Request, res: Response, next: NextFunction) {
    try {
        const id = idSchema.parse(req.params.id);
        const data = updateClientSchema.parse(req.body);
        const client = await clientsRepo.update(id, data);
        if (client === null) throw new NotFoundError("Client", id);
        res.json(client);
    } catch (err) {
        next(err);
    }
}