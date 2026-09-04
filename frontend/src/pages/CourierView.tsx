import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import TimeSelect from "../components/TimeSelect";
import type { DeliveryDay, OrderStatus } from "../types/domain";
import { currentWeekStart } from "../utils/dates";


interface DayStop {
    stop_id: number;
    order_id: number;
    client_id: number;
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

const SHIFT_END_HHMM = "20:00";

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

function nowHHMM(): string {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

export default function CourierView() {
    const [week, setWeek] = useState(currentWeekStart());
    const [day, setDay] = useState<DeliveryDay>("thursday");
    const [stops, setStops] = useState<DayStop[]>([]);
    const [showList, setShowList] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cash, setCash] = useState("");

    const [editOrderId, setEditOrderId] = useState<number | null>(null);
    const [changeTime, setChangeTime] = useState(true);
    const [changeAddress, setChangeAddress] = useState(false);
    const [mDay, setMDay] = useState<DeliveryDay>("thursday");
    const [mStart, setMStart] = useState("09:00");
    const [mEnd, setMEnd] = useState("20:00");
    const [mAddress, setMAddress] = useState("");

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

    const current = stops.find((s) => s.status === "assigned");
    const pendingFailed = stops.filter((s) => s.status === "failed_attempt");
    const doneCount = stops.filter((s) => s.status === "delivered").length;

    const totalCash = stops
    .filter((s) => s.status === "delivered")
    .reduce((sum, s) => sum + Number(s.paid_cash), 0);

    const totalTransfer = stops
    .filter((s) => s.status === "delivered")
    .reduce((sum, s) => sum + Number(s.paid_transfer), 0);

    const orderedStops = [
        ...stops.filter((s) => s.status !== "failed_attempt"),
        ...stops.filter((s) => s.status === "failed_attempt"),
    ];

    const total = current ? Number(current.total_amount) : 0;
    const cashNum = Number(cash) || 0;
    const transferNum = Math.max(0, total - cashNum);
    const overpaid = cashNum > total;

    useEffect(() => {
        if (current) setCash(current.total_amount);
    }, [current?.stop_id]);

    function openReschedule(stop: DayStop) {
        setEditOrderId(stop.order_id);
        setChangeTime(true);
        setChangeAddress(false);
        setMDay(day);
        setMStart("09:00");
        setMEnd("20:00");
        setMAddress(stop.address);
        setError(null);
    }

    async function runReroute() {
        await api.post("/routes/reroute", {
            delivery_week: week,
            day,
            current_time_min: nowInMinutes(),
        });
    }

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
            await api.patch(`/stops/${current.stop_id}`, {
                status: "failed_attempt",
            });
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setBusy(false);
        }
    }

    async function pushToEndOfDay(orderId: number) {
        setBusy(true);
        setError(null);
        try {
            await api.patch(`/orders/${orderId}/reschedule`, {
                time_windows: [
                    {
                        day,
                        start_time: `${nowHHMM()}:00`,
                        end_time: `${SHIFT_END_HHMM}:00`,
                    },
                ],
            });
            await runReroute();
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setBusy(false);
        }
    }

    async function moveToNextDay(orderId: number) {
        setBusy(true);
        setError(null);
        try {
            await api.patch(`/orders/${orderId}/reschedule`, {
                time_windows: [
                    { day: "friday", start_time: "09:00:00", end_time: "20:00:00" },
                ],
            });
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setBusy(false);
        }
    }

    async function cancelOrder(orderId: number) {
        setBusy(true);
        setError(null);
        try {
            await api.patch(`/orders/${orderId}/status`, {
                status: "dropped",
                drop_reason: "Cancelled during delivery",
            });
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setBusy(false);
        }
    }

    async function saveReschedule() {
        if (editOrderId === null) return;
        if (!changeTime && !changeAddress) {
            setError("Select what to change");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            if (changeAddress) {
                await api.patch(`/orders/${editOrderId}/delivery-address`, {
                    address: mAddress.trim(),
                });
            }
            if (changeTime) {
                await api.patch(`/orders/${editOrderId}/reschedule`, {
                    time_windows: [
                        { day: mDay, start_time: `${mStart}:00`, end_time: `${mEnd}:00` },
                    ],
                });
            }
            await runReroute();
            setEditOrderId(null);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setBusy(false);
        }
    }

    async function recalculate() {
        setBusy(true);
        setError(null);
        try {
            await runReroute();
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setBusy(false);
        }
    }

    function reschedulePanel(stop: DayStop) {
        return (
            <div className="mt-3 rounded-lg border border-blue-300 bg-blue-50 p-4">
                <p className="font-medium text-blue-900">
                    Reschedule: #{stop.client_id} {stop.client_name}
                </p>

                <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        checked={changeTime}
                        onChange={(e) => setChangeTime(e.target.checked)}
                    />
                    New time window
                </label>

                {changeTime && (
                    <div className="mt-2 flex flex-wrap gap-3">
                        <label className="flex flex-col text-xs text-slate-600">
                            Day
                            <select
                                value={mDay}
                                onChange={(e) => setMDay(e.target.value as DeliveryDay)}
                                className="mt-1 rounded border border-slate-300 px-2 py-2"
                            >
                                {DAYS.map((d) => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col text-xs text-slate-600">
                            From
                            <TimeSelect value={mStart} onChange={setMStart} />
                        </label>
                        <label className="flex flex-col text-xs text-slate-600">
                            To
                            <TimeSelect value={mEnd} onChange={setMEnd} />
                        </label>
                    </div>
                )}

                <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        checked={changeAddress}
                        onChange={(e) => setChangeAddress(e.target.checked)}
                    />
                    Different address for this delivery
                </label>

                {changeAddress && (
                    <>
                        <input
                            type="text"
                            value={mAddress}
                            onChange={(e) => setMAddress(e.target.value)}
                            className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                            This order only. The client's address stays unchanged.
                        </p>
                    </>
                )}

                <div className="mt-3 flex gap-2">
                    <button
                        onClick={saveReschedule}
                        disabled={busy}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                    >
                        {busy ? "Saving..." : "Save and recalculate"}
                    </button>
                    <button
                        onClick={() => setEditOrderId(null)}
                        className="rounded border border-slate-300 px-4 py-3 text-sm text-slate-600"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    function failedActions(stop: DayStop) {
        return (
            <div className="mt-2 flex flex-wrap gap-2">
                <button
                    onClick={() => pushToEndOfDay(stop.order_id)}
                    disabled={busy}
                    className="rounded border border-amber-400 px-3 py-1.5 text-xs text-amber-800 disabled:opacity-50"
                >
                    Retry later today
                </button>
                <button
                    onClick={() => moveToNextDay(stop.order_id)}
                    disabled={busy}
                    className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50"
                >
                    Move to Friday
                </button>
                <button
                    onClick={() => openReschedule(stop)}
                    disabled={busy}
                    className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50"
                >
                    Pick time
                </button>
                <button
                    onClick={() => cancelOrder(stop.order_id)}
                    disabled={busy}
                    className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700 disabled:opacity-50"
                >
                    Cancel
                </button>
            </div>
        );
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
                            <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => { setShowList((v) => !v); setEditOrderId(null); }}
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
                        {pendingFailed.length > 0 && ` · ${pendingFailed.length} to retry`}
                    </p>
                )}

                {showList && (
                    <div className="mt-3 space-y-2">
                        {stops.length === 0 && (
                            <p className="text-slate-500">No committed route for this day.</p>
                        )}
                        {orderedStops.map((s) => (
                            <div key={s.stop_id}>
                                <div
                                    className={`rounded-lg border p-3 ${
                                        s.status === "delivered"
                                            ? "border-emerald-200 bg-emerald-50"
                                            : s.status === "failed_attempt"
                                            ? "border-amber-300 bg-amber-50"
                                            : s.eta_min === null
                                            ? "border-amber-200 bg-amber-50"
                                            : "border-slate-200 bg-white"
                                    }`}
                                >
                                    <div className="flex justify-between gap-2">
                                        <span className="min-w-0 truncate font-medium text-slate-900">
                                            <span className="font-mono text-slate-400">
                                                #{s.client_id}
                                            </span>{" "}
                                            {s.client_name}
                                        </span>
                                        <span className="shrink-0 font-mono text-sm text-slate-500">
                                            {formatEta(s.eta_min)}
                                        </span>
                                    </div>
                                    <p className="truncate text-sm text-slate-500">{s.address}</p>

                                    {s.status === "failed_attempt" ? (
                                        <>
                                            <p className="mt-1 text-xs text-amber-800">
                                                Not at home
                                            </p>
                                            {failedActions(s)}
                                        </>
                                    ) : s.status !== "delivered" ? (
                                        <button
                                            onClick={() => openReschedule(s)}
                                            className="mt-2 rounded border border-slate-300 px-3 py-1 text-xs text-slate-600"
                                        >
                                            Reschedule
                                        </button>
                                    ) : null}
                                </div>
                                {editOrderId === s.order_id && reschedulePanel(s)}
                            </div>
                        ))}
                    </div>
                )}

                {!showList && current && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
                        <p className="font-mono text-sm text-slate-500">
                            {formatEta(current.eta_min)}
                        </p>

                        <div className="mt-1 flex flex-wrap items-baseline gap-2">
                            <h1 className="text-2xl font-bold text-slate-900">
                                {current.client_name}
                            </h1>
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-sm text-slate-600">
                                #{current.client_id}
                            </span>
                        </div>

                        <p className="mt-1 text-slate-600">{current.address}</p>

                        <div className="mt-3 flex gap-3">
                            <a
                                href={`tel:${current.phone_number}`}
                                className="text-blue-600 underline"
                            >
                                {current.phone_number}
                            </a>
                        </div>

                        <a
                            href={`geo:${current.lat},${current.lon}?q=${current.lat},${current.lon}`}
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
                            disabled={busy || overpaid}
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

                        <button
                            onClick={() => openReschedule(current)}
                            disabled={busy}
                            className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-700 disabled:opacity-50"
                        >
                            Reschedule or change address
                        </button>

                        {editOrderId === current.order_id && reschedulePanel(current)}

                        <button
                            onClick={recalculate}
                            disabled={busy}
                            className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-600 disabled:opacity-50"
                        >
                            Recalculate remaining route
                        </button>
                    </div>
                )}

                {!showList && !current && pendingFailed.length > 0 && (
                    <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
                        <p className="font-semibold text-amber-900">
                            {pendingFailed.length} stops need a decision
                        </p>
                        <p className="mt-1 text-sm text-amber-800">
                            Open today's list to retry, move or cancel them.
                        </p>
                    </div>
                )}

                {!showList && !current && pendingFailed.length === 0 && stops.length > 0 && (
                    <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
                        <p className="text-center text-lg font-semibold text-emerald-900">
                            All stops completed
                        </p>

                        <div className="mt-4 border-t border-emerald-200 pt-4">
                            <p className="text-sm font-medium text-emerald-900">Day closing</p>

                            <div className="mt-2 flex justify-between text-sm">
                                <span className="text-slate-700">Cash collected</span>
                                <span className="font-mono font-semibold text-slate-900">
                                    {totalCash.toFixed(2)} RON
                                </span>
                            </div>

                            <div className="mt-1 flex justify-between text-sm">
                                <span className="text-slate-700">Bank transfer</span>
                                <span className="font-mono font-semibold text-slate-900">
                                    {totalTransfer.toFixed(2)} RON
                                </span>
                            </div>

                            <div className="mt-2 flex justify-between border-t border-emerald-200 pt-2 text-sm">
                                <span className="font-medium text-slate-900">Total</span>
                                <span className="font-mono font-bold text-slate-900">
                                    {(totalCash + totalTransfer).toFixed(2)} RON
                                </span>
                            </div>

                            <p className="mt-3 text-xs text-slate-600">
                                {doneCount} deliveries completed
                            </p>
                        </div>
                    </div>
                )}

                {!showList && stops.length === 0 && !error && (
                    <p className="mt-6 text-slate-500">No committed route for this day.</p>
                )}
            </div>
        </div>
    );
}