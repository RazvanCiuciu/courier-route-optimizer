import { pool } from "../db";
import type { RouteStop, OrderStatus, DeliveryDay } from "../types/domain";

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

export interface StopWithDetails {
    readonly stop_id: number;
    readonly order_id: number;
    readonly sequence: number;
    readonly eta_min: number | null;
    readonly status: OrderStatus;
    readonly client_name: string;
    readonly address: string;
    readonly phone_number: string;
    readonly lat: number | null;
    readonly lon: number | null;
    readonly total_amount: string;
    readonly paid_cash: string;
    readonly paid_transfer: string;
    readonly client_id: number;
}

export async function findDayStops(
    week: string,
    day: DeliveryDay
): Promise<StopWithDetails[]> {
    const result = await pool.query<StopWithDetails>(
        `SELECT rs.id AS stop_id, rs.order_id, rs.sequence, rs.eta_min,
                c.id AS client_id,
                o.status, o.total_amount, o.paid_cash, o.paid_transfer,
                c.name AS client_name, c.phone_number,
                COALESCE(o.delivery_address, c.address) AS address,
                COALESCE(o.delivery_lat, c.lat) AS lat,
                COALESCE(o.delivery_lon, c.lon) AS lon
         FROM route_stops rs
         JOIN routes r  ON r.id = rs.route_id
         JOIN orders o  ON o.id = rs.order_id
         JOIN clients c ON c.id = o.client_id
         WHERE r.delivery_week = $1 AND r.day = $2 AND r.status = 'committed'
         ORDER BY rs.sequence`,
        [week, day]
    );
    return result.rows;
}
