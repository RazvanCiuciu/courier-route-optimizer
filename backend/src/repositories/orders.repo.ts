import { pool } from "../db";
import type { PoolClient } from "pg";
import type { Order, NewOrder,NewTimeWindow ,TimeWindow, OrderStatus, DeliveryDay } from "../types/domain";

export interface OrderWithWindows extends Order {
    readonly time_windows: TimeWindow[];
}

export async function findById(id: number): Promise<Order | null> {
    const result = await pool.query<Order>(
        "SELECT * FROM orders WHERE id = $1",
        [id]
    );
    return result.rows[0] ?? null;
}

export async function findByWeek(deliveryWeek: string): Promise<Order[]> {
       const result = await pool.query<Order>(
           "SELECT * FROM orders WHERE delivery_week = $1 ORDER BY id",[deliveryWeek]
       );
       return result.rows;
}

export async function findByWeekWithWindows(
    deliveryWeek: string
): Promise<OrderWithWindows[]> {
    const result = await pool.query(
        `SELECT o.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', tw.id,
                            'order_id', tw.order_id,
                            'day', tw.day,
                            'start_time', tw.start_time,
                            'end_time', tw.end_time
                        ) ORDER BY tw.day, tw.start_time
                    ) FILTER (WHERE tw.id IS NOT NULL),
                    '[]'
                ) AS time_windows
        FROM orders o
        LEFT JOIN time_windows tw ON tw.order_id = o.id
        WHERE o.delivery_week = $1
        GROUP BY o.id
        ORDER BY o.id`,
        [deliveryWeek]
    );
    return result.rows;
}

export async function create(data: NewOrder): Promise<OrderWithWindows> {
    const client: PoolClient = await pool.connect();
    try {
        await client.query("BEGIN");

    const orderResult = await client.query<Order>(
        `INSERT INTO orders (client_id, delivery_week, total_amount)
        VALUES ($1, $2, $3)
        RETURNING *`,
        [data.client_id, data.delivery_week, data.total_amount]
    );
        const order = orderResult.rows[0]!;

        const windows: TimeWindow[] = [];

        for (const w of data.time_windows) {
            const windowResult = await client.query<TimeWindow>(
                `INSERT INTO time_windows (order_id, day, start_time, end_time)
                VALUES ($1, $2, $3, $4)
                RETURNING *`,
                [order.id, w.day, w.start_time, w.end_time]
            );
            windows.push(windowResult.rows[0]!);
        }

        await client.query("COMMIT");
        return { ...order, time_windows: windows };        
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();   
    }
}

export async function updateStatus(
    id: number,
    status: OrderStatus,
    dropReason: string | null = null
): Promise<Order | null> {
        const result = await pool.query<Order>(
            `UPDATE orders
            SET status = $2, drop_reason = $3
            WHERE id = $1
            RETURNING *`,
            [id, status, dropReason]
    );
    return result.rows[0] ?? null;
}

export async function assignDay(
    id: number,
    day: DeliveryDay
): Promise<Order | null> {
        const result = await pool.query<Order>(
            `UPDATE orders
            SET assigned_day  = $2, status  = 'assigned'
            WHERE id = $1
            RETURNING *`,
            [id, day]
        );
        return result.rows[0] ?? null;
}

export async function recordPayment(
    id: number,
    paidCash: string,
    paidTransfer: string
): Promise<Order | null> {
        const result = await pool.query<Order>(
            `UPDATE orders
            SET paid_cash = $2, paid_transfer = $3
            WHERE id = $1
            RETURNING *`,
            [id,paidCash,paidTransfer]
        );
        return result.rows[0] ?? null;
}

export async function replaceTimeWindows(
    orderId: number,
    windows: readonly NewTimeWindow[]
): Promise<TimeWindow[]> {
    const client: PoolClient = await pool.connect();
    try {
        await client.query("BEGIN");

        await client.query("DELETE FROM time_windows WHERE order_id = $1", [orderId]);

        const inserted: TimeWindow[] = [];
        for (const w of windows) {
            const result = await client.query<TimeWindow>(
                `INSERT INTO time_windows (order_id, day, start_time, end_time)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [orderId, w.day, w.start_time, w.end_time]
            );
            inserted.push(result.rows[0]!);
        }

        await client.query("COMMIT");
        return inserted;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}