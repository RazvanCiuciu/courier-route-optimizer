import { useState } from "react";
import { api } from "../api/client";
import type { PreviewResult } from "../types/domain";
import { currentWeekStart } from "../utils/dates";



const DAY_LABEL: Record<string, string> = {
    thursday: "Thursday",
    friday: "Friday",
};

export default function RoutePreview() {
    const [week, setWeek] = useState(currentWeekStart());
    const [result, setResult] = useState<PreviewResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handlePreview() {
        setLoading(true);
        setError(null);
        try {
            const data = await api.post<PreviewResult>("/routes/preview", {
                delivery_week: week,
            });
            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
            setResult(null);
        } finally {
            setLoading(false);
        }
    }

    async function handleCommit() {
        setLoading(true);
        setError(null);
        try {
            const data = await api.post<PreviewResult>("/routes/commit", {
                delivery_week: week,
            });
            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-6">
            <div className="mx-auto max-w-3xl">
                <h1 className="text-2xl font-bold text-slate-900">Route optimization</h1>

                <div className="mt-6 flex flex-wrap items-end gap-3">
                    <label className="flex flex-col text-sm text-slate-600">
                        Delivery week
                        <input
                            type="date"
                            value={week}
                            onChange={(e) => setWeek(e.target.value)}
                            className="mt-1 rounded border border-slate-300 px-3 py-2 text-slate-900"
                        />
                    </label>

                    <button
                        onClick={handlePreview}
                        disabled={loading}
                        className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
                    >
                        {loading ? "Calculating..." : "Generate routes"}
                    </button>

                    {result && (
                        <button
                            onClick={handleCommit}
                            disabled={loading}
                            className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
                        >
                            Confirm
                        </button>
                    )}
                </div>

                {error && (
                    <p className="mt-4 rounded bg-red-50 px-4 py-3 text-red-700">{error}</p>
                )}

                {result && (
                    <div className="mt-6 space-y-4">
                        <p className="text-sm text-slate-600">
                            Total time: {result.total_time_min} min
                            {result.dropped_order_ids.length > 0 &&
                                ` · ${result.dropped_order_ids.length} unscheduled orders`}
                        </p>

                        {result.routes.map((route) => (
                            <div
                                key={route.vehicle_index}
                                className="rounded-lg border border-slate-200 bg-white p-4"
                            >
                                <div className="flex items-baseline justify-between">
                                    <h2 className="text-lg font-semibold text-slate-900">
                                        {DAY_LABEL[route.day] ?? route.day}
                                    </h2>
                                    <span className="text-sm text-slate-500">
                                        {route.stops.length} stops · {route.total_time_min} min
                                    </span>
                                </div>

                                {route.window_violations > 0 && (
                                    <p className="mt-1 text-sm text-amber-700">
                                        {route.window_violations} time windows violated
                                    </p>
                                )}

                                <ol className="mt-3 divide-y divide-slate-100">
                                    {route.stops.map((stop) => (
                                        <li
                                            key={stop.order_id}
                                            className="flex items-center gap-3 py-2"
                                        >
                                            <span className="w-14 shrink-0 font-mono text-sm text-slate-500">
                                                {stop.eta_display}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-slate-900">
                                                    {stop.client_name}
                                                </span>
                                                <span className="block truncate text-sm text-slate-500">
                                                    {stop.address}
                                                </span>
                                            </span>
                                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lon}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="shrink-0 rounded border border-slate-300 px-3 py-1 text-sm text-slate-700">
                                                Navigate
                                            </a>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}