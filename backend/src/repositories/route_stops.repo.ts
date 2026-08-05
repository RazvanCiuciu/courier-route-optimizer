import { pool } from "../db";
import type { RouteStop } from "../types/domain";

export async function findById(id: number): Promise<RouteStop | null> {
    const result = await pool.query<RouteStop>(
        "SELECT * FROM route_stops WHERE id = $1",
        [id]
    );
    return result.rows[0] ?? null;   
}

export async function findByRoute(routeId: number): Promise<RouteStop[]> {
    const result = await pool.query<RouteStop>(
        "SELECT * FROM route_stops WHERE route_id = $1 ORDER BY sequence",
        [routeId]
    );
    return result.rows;
}

export async function updateEta(id: number, etaMin: number): Promise<RouteStop | null> {
    const result = await pool.query<RouteStop>(
        "UPDATE route_stops SET eta_min = $2 WHERE id = $1 RETURNING *",
        [id,etaMin]
    );
    return result.rows[0] ?? null;
}
