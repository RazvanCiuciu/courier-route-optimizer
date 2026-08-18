import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Client, Order, TimeWindow, OrderStatus } from "../types/domain";

interface OrderWithWindows extends Order {
    time_windows: TimeWindow[];
}

const STATUS_STYLE: Record<OrderStatus, string> = {
    pending: "bg-slate-100 text-slate-700",
    assigned: "bg-blue-100 text-blue-800",
    delivered: "bg-emerald-100 text-emerald-800",
    failed_attempt: "bg-amber-100 text-amber-800",
    dropped: "bg-red-100 text-red-800",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
    pending: "Pending",
    assigned: "Scheduled",
    delivered: "Delivered",
    failed_attempt: "Not at home",
    dropped: "Unscheduled",
};

const DAY_LABEL: Record<string, string> = { thursday: "Thursday", friday: "Friday" };

export default function OrdersList() {
    const [week, setWeek] = useState("2026-08-10");
    const [orders, setOrders] = useState<OrderWithWindows[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Re-runs whenever week changes
    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);
            try {
                const [o, c] = await Promise.all([
                    api.get<OrderWithWindows[]>(`/orders?week=${week}`),
                    api.get<Client[]>("/clients"),
                ]);
                if (!cancelled) {
                    setOrders(o);
                    setClients(c);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Unknown error");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [week]);

    const clientById = new Map(clients.map((c) => [c.id, c]));

    return (
        <div className="p-6">
            <div className="mx-auto max-w-3xl">
                <h1 className="text-2xl font-bold text-slate-900">Orders</h1>

                <label className="mt-6 flex w-fit flex-col text-sm text-slate-600">
                    Delivery week
                    <input
                        type="date"
                        value={week}
                        onChange={(e) => setWeek(e.target.value)}
                        className="mt-1 rounded border border-slate-300 px-3 py-2 text-slate-900"
                    />
                </label>

                {loading && <p className="mt-4 text-slate-500">Loading...</p>}

                {error && (
                    <p className="mt-4 rounded bg-red-50 px-4 py-3 text-red-700">{error}</p>
                )}

                {!loading && !error && orders.length === 0 && (
                    <p className="mt-6 text-slate-500">No orders for this week.</p>
                )}

                <div className="mt-6 space-y-3">
                    {orders.map((order) => {
                        const client = clientById.get(order.client_id);
                        return (
                            <div
                                key={order.id}
                                className="rounded-lg border border-slate-200 bg-white p-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-slate-900">
                                            {client?.name ?? `Client #${order.client_id}`}
                                        </p>
                                        <p className="truncate text-sm text-slate-500">
                                            {client?.address ?? ""}
                                        </p>
                                    </div>
                                    <span
                                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[order.status]}`}
                                    >
                                        {STATUS_LABEL[order.status]}
                                    </span>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    {order.time_windows.map((w) => (
                                        <span
                                            key={w.id}
                                            className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600"
                                        >
                                            {DAY_LABEL[w.day]} {w.start_time.slice(0, 5)}–
                                            {w.end_time.slice(0, 5)}
                                        </span>
                                    ))}
                                </div>

                                <div className="mt-3 flex justify-between text-sm text-slate-500">
                                    <span>
                                        {order.assigned_day
                                            ? `Scheduled: ${DAY_LABEL[order.assigned_day]}`
                                            : "Unscheduled"}
                                    </span>
                                    <span>{order.total_amount} RON</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}