import * as ordersRepo from "../repositories/orders.repo";
import * as clientsRepo from "../repositories/clients.repo";
import * as solverService from "./solver.service";
import { ensureCoordinates, type Coordinates } from "./geocoding.service";
import { getTravelTimeMatrix } from "./osrm.service";
import { pool } from "../db";
import { ValidationError, NotFoundError } from "../errors";
import type { DeliveryDay } from "../types/domain";
import type { PoolClient } from "pg";
import * as stopsRepo from "../repositories/route_stops.repo";

const DEPOT: Coordinates = {
    lat: Number(process.env.DEPOT_LAT),
    lon: Number(process.env.DEPOT_LON),
};

const SHIFT_START = Number(process.env.SHIFT_START_MIN ?? 480);
const SHIFT_END = Number(process.env.SHIFT_END_MIN ?? 1080);
const SERVICE_TIME = Number(process.env.SERVICE_TIME_MIN ?? 13);

const MINUTES_PER_DAY = 1440;
const DAY_INDEX: Record<DeliveryDay, number> = { thursday: 0, friday: 1 };
const DAYS: DeliveryDay[] = ["thursday", "friday"];

function timeToMinutes(time: string, day: DeliveryDay): number {
    const parts = time.split(":");
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    let result = hours*60 + minutes + DAY_INDEX[day]*MINUTES_PER_DAY;
  
    return result;
}

function minutesToDayTime(total: number): { day: DeliveryDay; time: string } {
    const dayIdx = Math.floor(total / MINUTES_PER_DAY);
    const inDay = total % MINUTES_PER_DAY;
    const hh = String(Math.floor(inDay / 60)).padStart(2, "0");
    const mm = String(inDay % 60).padStart(2, "0");
    return { day: DAYS[dayIdx] ?? "friday", time: `${hh}:${mm}` };
}

export interface PreviewStop {
    readonly order_id: number;
    readonly client_name: string;
    readonly address: string;
    readonly lat: number;
    readonly lon: number;
    readonly sequence: number;
    readonly eta_min: number;
    readonly eta_display: string;
}

export interface PreviewRoute {
    readonly day: DeliveryDay;
    readonly vehicle_index: number;
    readonly total_time_min: number;
    readonly window_violations: number;
    readonly stops: PreviewStop[];
}

export interface PreviewResult {
    readonly delivery_week: string;
    readonly routes: PreviewRoute[];
    readonly dropped_order_ids: number[];
    readonly total_time_min: number;
}

export async function previewRoutes(week: string): Promise<PreviewResult> {
    const orders = await ordersRepo.findByWeekWithWindows(week);

    const pending = orders.filter(
        (o) => o.status === "pending" || o.status === "assigned"
    );

    if (pending.length === 0) {
        throw new ValidationError(`No routable orders for week ${week}`);
    }

    const coords: Coordinates[] = [DEPOT];
    const orderIds: number[] = [];
    const meta = new Map<number, { name: string; address: string }>();
    const locations: solverService.SolverLocation[] = [
        {
            index: 0,
            time_windows: [{ start: 0, end: DAYS.length * MINUTES_PER_DAY }],
            service_time_min: 0,
        },
    ];

    for (const order of pending) {
        const client = await clientsRepo.findById(order.client_id);
        if (client === null) {
            throw new NotFoundError("Client", order.client_id);
        }

        const c = await ensureCoordinates(client);

        const index = coords.length;
        coords.push(c);
        orderIds[index] = order.id;
        meta.set(index, { name: client.name, address: client.address });

        locations.push({
            index,
            time_windows: order.time_windows.map((w) => ({
                start: timeToMinutes(w.start_time, w.day),
                end: timeToMinutes(w.end_time, w.day),
            })),
            service_time_min: SERVICE_TIME,
        });
    }

    const matrix = await getTravelTimeMatrix(coords);

    const vehicles: solverService.SolverVehicle[] = DAYS.map((day) => ({
        id: DAY_INDEX[day],
        shift_start: SHIFT_START + DAY_INDEX[day] * MINUTES_PER_DAY,
        shift_end: SHIFT_END + DAY_INDEX[day] * MINUTES_PER_DAY,
        max_stops: 60,
    }));

    const solution = await solverService.solve({
        vehicles,
        start_location_index: 0,
        locations,
        travel_time_matrix: matrix,
    });

    const routes: PreviewRoute[] = solution.routes.map((r) => ({
        day: DAYS[r.vehicle] ?? "friday",
        vehicle_index: r.vehicle,
        total_time_min: r.total_time_min,
        window_violations: r.window_violations,
        stops: r.stops.map((s, seq) => {
            const info = meta.get(s.index);
            return {
                order_id: orderIds[s.index]!,
                client_name: info?.name ?? "",
                address: info?.address ?? "",
                lat: coords[s.index]!.lat,
                lon: coords[s.index]!.lon,
                sequence: seq,
                eta_min: s.eta,
                eta_display: minutesToDayTime(s.eta).time,
            };
        }),
    }));

    return {
        delivery_week: week,
        routes,
        dropped_order_ids: solution.dropped.map((i) => orderIds[i]!),
        total_time_min: solution.total_time_min,
    };
}

export async function commitRoutes(preview: PreviewResult): Promise<void> {
    const client: PoolClient = await pool.connect();
    try {
        await client.query("BEGIN");

        await client.query("DELETE FROM routes WHERE delivery_week = $1", [
            preview.delivery_week,
        ]);

        for (const route of preview.routes) {
            const routeResult = await client.query<{ id: number }>(
                `INSERT INTO routes (delivery_week, day, vehicle_index, total_time_min, status)
                 VALUES ($1, $2, $3, $4, 'committed')
                 RETURNING id`,
                [
                    preview.delivery_week,
                    route.day,
                    route.vehicle_index,
                    route.total_time_min,
                ]
            );
            const routeId = routeResult.rows[0]!.id;

            for (const stop of route.stops) {
                await client.query(
                    `INSERT INTO route_stops (route_id, order_id, sequence, eta_min)
                     VALUES ($1, $2, $3, $4)`,
                    [routeId, stop.order_id, stop.sequence, stop.eta_min]
                );

                await client.query(
                    `UPDATE orders
                     SET assigned_day = $2, status = 'assigned'
                     WHERE id = $1 AND status = 'pending'`,
                    [stop.order_id, route.day]
                );
            }
        }

        for (const orderId of preview.dropped_order_ids) {
            await client.query(
                `UPDATE orders
                 SET status = 'dropped', drop_reason = 'No feasible route'
                 WHERE id = $1 AND status = 'pending'`,
                [orderId]
            );
        }

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

export async function rerouteRemaining(
    week: string,
    day: DeliveryDay,
    currentTimeMin: number
): Promise<PreviewResult> {
    const stops = await stopsRepo.findDayStops(week, day);

    const done = stops.filter((s) => s.status === "delivered");
    const remaining = stops.filter(
        (s) => s.status === "assigned" || s.status === "failed_attempt"
    );

    if (remaining.length === 0) {
        throw new ValidationError("No remaining stops for this day");
    }

    const last = done[done.length - 1];
    const origin: Coordinates =
        last && last.lat !== null && last.lon !== null
            ? { lat: last.lat, lon: last.lon }
            : DEPOT;

    const dayOffset = DAY_INDEX[day] * MINUTES_PER_DAY;

    const coords: Coordinates[] = [origin];
    const orderIds: number[] = [];
    const meta = new Map<number, { name: string; address: string }>();
    const locations: solverService.SolverLocation[] = [
        {
            index: 0,
            time_windows: [{ start: 0, end: DAYS.length * MINUTES_PER_DAY }],
            service_time_min: 0,
        },
    ];

    const orders = await ordersRepo.findByWeekWithWindows(week);
    const ordersById = new Map(orders.map((o) => [o.id, o]));

    for (const stop of remaining) {
        if (stop.lat === null || stop.lon === null) continue;

        const order = ordersById.get(stop.order_id);
        if (order === undefined) continue;

        const todayWindows = order.time_windows.filter((w) => w.day === day);
        if (todayWindows.length === 0) continue;

        const index = coords.length;
        coords.push({ lat: stop.lat, lon: stop.lon });
        orderIds[index] = stop.order_id;
        meta.set(index, { name: stop.client_name, address: stop.address });

        locations.push({
            index,
            time_windows: todayWindows.map((w) => ({
                start: Math.max(timeToMinutes(w.start_time, day), currentTimeMin + dayOffset),
                end: timeToMinutes(w.end_time, day),
            })),
            service_time_min: SERVICE_TIME,
        });
    }

    if (coords.length === 1) {
        throw new ValidationError("No routable stops remaining");
    }

    const matrix = await getTravelTimeMatrix(coords);

    const vehicles: solverService.SolverVehicle[] = [
        {
            id: DAY_INDEX[day],
            shift_start: currentTimeMin + dayOffset,
            shift_end: SHIFT_END + dayOffset,
            max_stops: 60,
        },
    ];

    const solution = await solverService.solve({
        vehicles,
        start_location_index: 0,
        locations,
        travel_time_matrix: matrix,
    });

    const routes: PreviewRoute[] = solution.routes.map((r) => ({
        day,
        vehicle_index: r.vehicle,
        total_time_min: r.total_time_min,
        window_violations: r.window_violations,
        stops: r.stops.map((s, seq) => {
            const info = meta.get(s.index);
            return {
                order_id: orderIds[s.index]!,
                client_name: info?.name ?? "",
                address: info?.address ?? "",
                lat: coords[s.index]!.lat,
                lon: coords[s.index]!.lon,
                sequence: seq,
                eta_min: s.eta,
                eta_display: minutesToDayTime(s.eta).time,
            };
        }),
    }));

    return {
        delivery_week: week,
        routes,
        dropped_order_ids: solution.dropped.map((i) => orderIds[i]!),
        total_time_min: solution.total_time_min,
    };
}

export async function commitReroute(
    week: string,
    day: DeliveryDay,
    preview: PreviewResult
): Promise<void> {
    const client: PoolClient = await pool.connect();
    try {
        await client.query("BEGIN");

        const routeResult = await client.query<{ id: number }>(
            `SELECT id FROM routes
             WHERE delivery_week = $1 AND day = $2 AND status = 'committed'
             LIMIT 1`,
            [week, day]
        );
        const routeId = routeResult.rows[0]?.id;
        if (routeId === undefined) {
            throw new NotFoundError("Committed route", `${week}/${day}`);
        }

        await client.query(
            `DELETE FROM route_stops rs
             USING orders o
             WHERE rs.order_id = o.id
               AND rs.route_id = $1
               AND o.status <> 'delivered'`,
            [routeId]
        );

        const maxSeq = await client.query<{ max: number | null }>(
            "SELECT MAX(sequence) AS max FROM route_stops WHERE route_id = $1",
            [routeId]
        );
        let seq = (maxSeq.rows[0]?.max ?? -1) + 1;

        for (const route of preview.routes) {
            for (const stop of route.stops) {
                await client.query(
                    `INSERT INTO route_stops (route_id, order_id, sequence, eta_min)
                     VALUES ($1, $2, $3, $4)`,
                    [routeId, stop.order_id, seq, stop.eta_min]
                );
                seq++;
            }
        }

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}