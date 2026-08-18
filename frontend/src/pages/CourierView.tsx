import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { DeliveryDay, OrderStatus } from "../types/domain";

interface DayStop {
    stop_id: number;
    order_id: number;
    sequence: number;
    eta_min: number | null;
    status: OrderStatus;
    client_name: string;
    address: string;
    phone_number: string;
    lat: number | null;
    lon: number | null;
    total_amount: string;
    paid_cash: string;
    paid_transfer: string;
}

const DAYS: { value: DeliveryDay; label: string }[] = [
    { value: "thursday", label: "Thursday" },
    { value: "friday", label: "Friday" },
];

function formatEta(min: number | null): string {
    if (min === null) return "—";
    const inDay = min % 1440;
    const hh = String(Math.floor(inDay / 60)).padStart(2, "0");
    const mm = String(inDay % 60).padStart(2, "0");
    return `${hh}:${mm}`;
}

function nowInMinutes(): number {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

export default function CourierView() {
    const [week, setWeek] = useState("2026-08-10");
    const [day, setDay] = useState<DeliveryDay>("thursday");
    const [stops, setStops] = useState<DayStop[]>([]);
    const [showList, setShowList] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cash, setCash] = useState("");
    const [showReschedule, setShowReschedule] = useState(false);
    const [newDay, setNewDay] = useState<DeliveryDay>("thursday");
    const [newStart, setNewStart] = useState("16:00");
    const [newEnd, setNewEnd] = useState("19:00");

    const load = useCallback(async () => {
        setError(null);
        try {
            const data = await api.get<DayStop[]>(
                `/routes/day?week=${week}&day=${day}`
            );
            setStops(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
            setStops([]);
        }
    }, [week, day]);

    useEffect(() => {
        load();
    }, [load]);

    const current = stops.find(
        (s) => s.status === "assigned" || s.status === "failed_attempt"
    );
    const doneCount = stops.filter((s) => s.status === "delivered").length;
    const total = current ? Number(current.total_amount) : 0;
    const cashNum = Number(cash) || 0;
    const transferNum = Math.max(0, total - cashNum);
    const overpaid = cashNum > total;

    useEffect(() => {
        if (current) {
            setCash(current.total_amount);
        }
    }, [current?.stop_id]);

    async function markDelivered() {
        if (!current) return;
        setBusy(true);
        setError(null);
        try {
            await api.patch(`/stops/${current.stop_id}`, {
                status: "delivered",
                paid_cash: cashNum.toFixed(2),
                paid_transfer: transferNum.toFixed(2),
            });
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setBusy(false);
        }
    }

    async function markNotHome() {
        if (!current) return;
        setBusy(true);
        setError(null);
        try {
            await api.patch(`/stops/${current.stop_id}`, { status: "failed_attempt" });
            setNewDay(day);
            setShowReschedule(true);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setBusy(false);
        }
    }

    async function confirmReschedule() {
        if (!current) return;
        setBusy(true);
        setError(null);
        try {
            await api.patch(`/orders/${current.order_id}/reschedule`, {
                time_windows: [
                    { day: newDay, start_time: `${newStart}:00`, end_time: `${newEnd}:00` },
                ],
            });
            // Repune comanda in ordinea rutei
            await api.post("/routes/reroute", {
                delivery_week: week,
                day,
                current_time_min: nowInMinutes(),
            });
            setShowReschedule(false);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setBusy(false);
        }
    }

    async function dropOrder() {
        if (!current) return;
        setBusy(true);
        setError(null);
        try {
            await api.patch(`/orders/${current.order_id}/status`, {
                status: "dropped",
                drop_reason: "Client not reachable",
            });
            setShowReschedule(false);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setBusy(false);
        }
    }

    async function reroute() {
        setBusy(true);
        setError(null);
        try {
            await api.post("/routes/reroute", {
                delivery_week: week,
                day,
                current_time_min: nowInMinutes(),
            });
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="p-4">
            <div className="mx-auto max-w-md">
                <div className="flex flex-wrap items-end gap-2">
                    <input
                        type="date"
                        value={week}
                        onChange={(e) => setWeek(e.target.value)}
                        className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <select
                        value={day}
                        onChange={(e) => setDay(e.target.value as DeliveryDay)}
                        className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                    >
                        {DAYS.map((d) => (
                            <option key={d.value} value={d.value}>
                                {d.label}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => setShowList((v) => !v)}
                        className="ml-auto rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                    >
                        {showList ? "Current stop" : "Today's list"}
                    </button>
                </div>

                {error && (
                    <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </p>
                )}

                {stops.length > 0 && (
                    <p className="mt-3 text-sm text-slate-500">
                        {doneCount} of {stops.length} delivered
                    </p>
                )}

                {showList && (
                    <div className="mt-3 space-y-2">
                        {stops.length === 0 && (
                            <p className="text-slate-500">No committed route for this day.</p>
                        )}
                        {stops.map((s) => (
                            <div
                                key={s.stop_id}
                                className={`rounded-lg border p-3 ${
                                    s.status === "delivered"
                                        ? "border-emerald-200 bg-emerald-50"
                                        : "border-slate-200 bg-white"
                                }`}
                            >
                                <div className="flex justify-between gap-2">
                                    <span className="min-w-0 truncate font-medium text-slate-900">
                                        {s.client_name}
                                    </span>
                                    <span className="shrink-0 font-mono text-sm text-slate-500">
                                        {formatEta(s.eta_min)}
                                    </span>
                                </div>
                                <p className="truncate text-sm text-slate-500">{s.address}</p>
                            </div>
                        ))}
                    </div>
                )}

                {!showList && current && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
                        <p className="font-mono text-sm text-slate-500">
                            {formatEta(current.eta_min)}
                        </p>
                        <h1 className="mt-1 text-2xl font-bold text-slate-900">
                            {current.client_name}
                        </h1>
                        <p className="mt-1 text-slate-600">{current.address}</p>

                        <div className="mt-3 flex gap-3">
                            <a
                                href={`tel:${current.phone_number}`}
                                className="text-blue-600 underline"
                            >
                                {current.phone_number}
                            </a>
                        </div>

                        {current.status === "failed_attempt" && (
                            <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                Previous attempt failed — client was not at home.
                            </p>
                        )}

                        <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${current.lat},${current.lon}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 block rounded-lg bg-blue-600 px-4 py-4 text-center text-lg font-semibold text-white"
                        >
                            Navigate
                        </a>

                        <div className="mt-5 border-t border-slate-200 pt-4">
                            <p className="text-sm text-slate-500">
                                Total:{" "}
                                <span className="font-semibold text-slate-900">
                                    {current.total_amount} RON
                                </span>
                            </p>

                            <label className="mt-3 flex flex-col text-xs text-slate-500">
                                Cash received
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={cash}
                                    onChange={(e) => setCash(e.target.value)}
                                    className="mt-1 rounded border border-slate-300 px-3 py-3 text-xl text-slate-900"
                                />
                            </label>

                            <div className="mt-2 flex gap-2">
                                <button
                                    onClick={() => setCash(current.total_amount)}
                                    className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm text-slate-600"
                                >
                                    All cash
                                </button>
                                <button
                                    onClick={() => setCash("0")}
                                    className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm text-slate-600"
                                >
                                    All transfer
                                </button>
                            </div>

                            {overpaid ? (
                                <p className="mt-2 text-sm text-red-700">
                                    Cash exceeds the total amount.
                                </p>
                            ) : (
                                <p className="mt-2 text-sm text-slate-600">
                                    By transfer:{" "}
                                    <span className="font-medium text-slate-900">
                                        {transferNum.toFixed(2)} RON
                                    </span>
                                </p>
                            )}
                        </div>

                        <button
                            onClick={markDelivered}
                            disabled={busy}
                            className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-4 text-lg font-semibold text-white disabled:opacity-50"
                        >
                            {busy ? "Saving..." : "Delivered"}
                        </button>

                        <button
                            onClick={markNotHome}
                            disabled={busy}
                            className="mt-2 w-full rounded-lg border border-amber-300 px-4 py-3 font-medium text-amber-800 disabled:opacity-50"
                        >
                            Not at home
                        </button>

                        {showReschedule && (
                        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                            <p className="font-medium text-amber-900">Reschedule this order</p>

                            <div className="mt-3 flex gap-2">
                                <label className="flex flex-1 flex-col text-xs text-slate-600">
                                    Day
                                    <select
                                        value={newDay}
                                        onChange={(e) => setNewDay(e.target.value as DeliveryDay)}
                                        className="mt-1 rounded border border-slate-300 px-2 py-2"
                                    >
                                        {DAYS.map((d) => (
                                            <option key={d.value} value={d.value}>{d.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="flex flex-1 flex-col text-xs text-slate-600">
                                    From
                                    <input
                                        type="time"
                                        value={newStart}
                                        onChange={(e) => setNewStart(e.target.value)}
                                        className="mt-1 rounded border border-slate-300 px-2 py-2"
                                    />
                                </label>
                                <label className="flex flex-1 flex-col text-xs text-slate-600">
                                    To
                                    <input
                                        type="time"
                                        value={newEnd}
                                        onChange={(e) => setNewEnd(e.target.value)}
                                        className="mt-1 rounded border border-slate-300 px-2 py-2"
                                    />
                                </label>
                            </div>

                            <button
                                onClick={confirmReschedule}
                                disabled={busy}
                                className="mt-3 w-full rounded-lg bg-amber-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                            >
                                Reschedule and recalculate
                            </button>

                            <div className="mt-2 flex gap-2">
                                <button
                                    onClick={dropOrder}
                                    disabled={busy}
                                    className="flex-1 rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
                                >
                                    Cancel order
                                </button>
                                <button
                                    onClick={() => setShowReschedule(false)}
                                    className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm text-slate-600"
                                >
                                    Decide later
                                </button>
                            </div>
                        </div>
                    )}

                        <button
                            onClick={reroute}
                            disabled={busy}
                            className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-600 disabled:opacity-50"
                        >
                            Recalculate remaining route
                        </button>
                    </div>
                )}

                {!showList && !current && stops.length > 0 && (
                    <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                        <p className="text-lg font-semibold text-emerald-900">
                            All stops completed
                        </p>
                    </div>
                )}

                {!showList && stops.length === 0 && !error && (
                    <p className="mt-6 text-slate-500">No committed route for this day.</p>
                )}
            </div>
        </div>
    );
}