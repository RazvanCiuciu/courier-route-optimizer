import "dotenv/config";
import { pool } from "../db";

const ZONES = [
    { name: "Giroc", lat: 45.7080, lon: 21.2340 },
    { name: "Mosnita", lat: 45.7250, lon: 21.3050 },
    { name: "Dumbravita", lat: 45.7920, lon: 21.2450 },
    { name: "Ghiroda", lat: 45.7690, lon: 21.2860 },
    { name: "Sanandrei", lat: 45.8340, lon: 21.1930 },
    { name: "Centru", lat: 45.7540, lon: 21.2250 },
    { name: "Soarelui", lat: 45.7290, lon: 21.2170 },
    { name: "Torontalului", lat: 45.7720, lon: 21.2180 },
    { name: "Buziasului", lat: 45.7420, lon: 21.2600 },
    { name: "Aradului", lat: 45.7690, lon: 21.2240 },
];

const WINDOWS = [
    { start: "09:00:00", end: "11:00:00" },
    { start: "10:00:00", end: "12:00:00" },
    { start: "12:00:00", end: "14:00:00" },
    { start: "14:00:00", end: "16:00:00" },
    { start: "16:00:00", end: "18:00:00" },
    { start: "18:00:00", end: "20:00:00" },
];

interface Instance {
    week: string;
    count: number;
    distribution: "uniform" | "clustered";
    seed: number;
}

const INSTANCES: Instance[] = [
    { week: "2026-09-10", count: 30, distribution: "uniform", seed: 42 },
    { week: "2026-09-17", count: 45, distribution: "clustered", seed: 42 },
];

function makeRandom(seed: number) {
    let state = seed;
    return function random(): number {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
    };
}

async function seedInstance(inst: Instance) {
    const random = makeRandom(inst.seed);
    let doubleWindowCount = 0;

    for (let i = 0; i < inst.count; i++) {
        const zone = ZONES[i % ZONES.length]!;

        const lat = zone.lat + (random() - 0.5) * 0.018;
        const lon = zone.lon + (random() - 0.5) * 0.025;

        const clientResult = await pool.query<{ id: number }>(
            `INSERT INTO clients (name, address, phone_number, lat, lon)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [
                `Exp ${inst.distribution} ${i + 1}`,
                `${zone.name}, Timisoara`,
                `0720${inst.count}${String(i).padStart(3, "0")}`,
                lat,
                lon,
            ]
        );
        const clientId = clientResult.rows[0]!.id;

        const orderResult = await pool.query<{ id: number }>(
            `INSERT INTO orders (client_id, delivery_week, total_amount)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [clientId, inst.week, (20 + Math.floor(random() * 80)).toFixed(2)]
        );
        const orderId = orderResult.rows[0]!.id;

        const idx =
            inst.distribution === "uniform"
                ? i % WINDOWS.length
                : Math.floor(random() * WINDOWS.length);
        const w1 = WINDOWS[idx]!;

        await pool.query(
            `INSERT INTO time_windows (order_id, day, start_time, end_time)
             VALUES ($1, 'thursday', $2, $3)`,
            [orderId, w1.start, w1.end]
        );

        if (random() < 0.3) {
            const idx2 = (idx + 2 + Math.floor(random() * 2)) % WINDOWS.length;
            if (idx2 !== idx) {
                const w2 = WINDOWS[idx2]!;
                await pool.query(
                    `INSERT INTO time_windows (order_id, day, start_time, end_time)
                     VALUES ($1, 'thursday', $2, $3)`,
                    [orderId, w2.start, w2.end]
                );
                doubleWindowCount++;
            }
        }
    }

    console.log(
        `${inst.week}: ${inst.count} comenzi (${inst.distribution}), ` +
        `${doubleWindowCount} cu doua ferestre`
    );
}

async function main() {
    for (const inst of INSTANCES) {
        await pool.query(
            `DELETE FROM route_stops rs USING routes r
             WHERE rs.route_id = r.id AND r.delivery_week = $1`,
            [inst.week]
        );
        await pool.query("DELETE FROM routes WHERE delivery_week = $1", [inst.week]);
        await pool.query(
            `DELETE FROM time_windows tw USING orders o
             WHERE tw.order_id = o.id AND o.delivery_week = $1`,
            [inst.week]
        );
        await pool.query("DELETE FROM orders WHERE delivery_week = $1", [inst.week]);
    }
    await pool.query("DELETE FROM clients WHERE name LIKE 'Exp %'");

    for (const inst of INSTANCES) {
        await seedInstance(inst);
    }

    const dist = await pool.query(
        `SELECT o.delivery_week, tw.start_time, COUNT(*)
         FROM orders o JOIN time_windows tw ON tw.order_id = o.id
         WHERE o.delivery_week = ANY($1)
         GROUP BY 1, 2 ORDER BY 1, 2`,
        [INSTANCES.map((i) => i.week)]
    );
    console.log("\nDistributia ferestrelor:");
    for (const row of dist.rows) {
        console.log(`  ${row.delivery_week}  ${row.start_time}  ${row.count}`);
    }

    await pool.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});