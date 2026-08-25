import { pool } from "../db";
import type { Client, NewClient } from "../types/domain";

export async function findAll(): Promise<Client[]> {
    const result = await pool.query<Client>(
        "SELECT * FROM clients ORDER BY id"
    );
    return result.rows;
}

export async function findById(id: number): Promise<Client | null> {
    const result = await pool.query<Client>(
        "SELECT * FROM clients WHERE id = $1",
        [id]
    );
    return result.rows[0] ?? null;
}

export async function create(data: NewClient): Promise<Client> {
    const result = await pool.query<Client>(
        `INSERT INTO clients (name, address, phone_number)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [data.name, data.address, data.phone_number]
    );
    return result.rows[0]!;
}

export async function updateCoordinates(
    id: number,
    lat: number,
    lon: number
): Promise<void> {
    await pool.query(
        "UPDATE clients SET lat = $2, lon = $3 WHERE id = $1",
        [id, lat, lon]
    );
}

export async function update(
    id: number,
    data: { name: string; address: string; phone_number: string }
): Promise<Client | null> {
    const result = await pool.query<Client>(
        `UPDATE clients
         SET name = $2,
             address = $3,
             phone_number = $4,
             lat = CASE WHEN address <> $3 THEN NULL ELSE lat END,
             lon = CASE WHEN address <> $3 THEN NULL ELSE lon END
         WHERE id = $1
         RETURNING *`,
        [id, data.name, data.address, data.phone_number]
    );
    return result.rows[0] ?? null;
}