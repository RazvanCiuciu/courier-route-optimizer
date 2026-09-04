import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import TimeInput from "../components/TimeInput";
import type { Client, DeliveryDay, NewTimeWindow } from "../types/domain";
import { currentWeekStart } from "../utils/dates";


const DAYS: { value: DeliveryDay; label: string }[] = [
    { value: "thursday", label: "Thursday" },
    { value: "friday", label: "Friday" },
];

interface WindowDraft {
    key: number;
    day: DeliveryDay;
    start_time: string;
    end_time: string;
}

let nextKey = 1;

function emptyWindow(): WindowDraft {
    return { key: nextKey++, day: "thursday", start_time: "09:00", end_time: "20:00" };
}

export default function OrderForm() {
    const navigate = useNavigate();

    const [clients, setClients] = useState<Client[]>([]);
    const [clientId, setClientId] = useState<number | "">("");
    const [week, setWeek] = useState(currentWeekStart());
    const [amount, setAmount] = useState("");
    const [windows, setWindows] = useState<WindowDraft[]>([emptyWindow()]);

    const [addressWarning, setAddressWarning] = useState(false);
    const [overrideAddress, setOverrideAddress] = useState("");

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get<Client[]>("/clients")
            .then(setClients)
            .catch((err) =>
                setError(err instanceof Error ? err.message : "Unknown error")
            );
    }, []);

    async function checkClientAddress(id: number) {
        const client = clients.find((c) => c.id === id);
        if (!client) return;

        if (client.lat !== null && client.lon !== null) {
            setAddressWarning(false);
            return;
        }

        try {
            const result = await api.post<{ found: boolean }>("/clients/check-address", {
                address: client.address,
            });
            setAddressWarning(!result.found);
            if (!result.found) setOverrideAddress(client.address);
        } catch {
            setAddressWarning(false);
        }
    }

    function addWindow() {
        setWindows((prev) => [...prev, emptyWindow()]);
    }

    function removeWindow(key: number) {
        setWindows((prev) => prev.filter((w) => w.key !== key));
    }

    function updateWindow(key: number, patch: Partial<Omit<WindowDraft, "key">>) {
        setWindows((prev) =>
            prev.map((w) => (w.key === key ? { ...w, ...patch } : w))
        );
    }

    function validate(): string | null {
        if (clientId === "") return "Select a client";
        if (!/^\d+(\.\d{1,2})?$/.test(amount)) return "Amount must be a number, e.g. 85.50";
        if (windows.length === 0) return "Add at least one time window";
        const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
        for (const w of windows) {
            if (!timeRegex.test(w.start_time) || !timeRegex.test(w.end_time)) {
                return "Time must be in HH:MM format";
            }
            if (w.start_time >= w.end_time) {
                return `Invalid window: ${w.start_time} is not before ${w.end_time}`;
            }
        }
        return null;
    }

    async function handleSubmit() {
        const problem = validate();
        if (problem !== null) {
            setError(problem);
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const payload = {
                client_id: Number(clientId),
                delivery_week: week,
                total_amount: amount,
                time_windows: windows.map<NewTimeWindow>((w) => ({
                    day: w.day,
                    start_time: `${w.start_time}:00`,
                    end_time: `${w.end_time}:00`,
                })),
            };

            const created = await api.post<{ id: number }>("/orders", payload);

            if (addressWarning && overrideAddress.trim() !== "") {
                await api.patch(`/orders/${created.id}/delivery-address`, {
                    address: overrideAddress.trim(),
                });
            }

            navigate("/orders");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="p-6">
            <div className="mx-auto max-w-2xl">
                <h1 className="text-2xl font-bold text-slate-900">New order</h1>

                <div className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
                    <label className="flex flex-col text-sm text-slate-600">
                        Client
                        <select
                            value={clientId}
                            onChange={(e) => {
                                const v = e.target.value === "" ? "" : Number(e.target.value);
                                setClientId(v);
                                setAddressWarning(false);
                                if (v !== "") checkClientAddress(v);
                            }}
                            className="mt-1 rounded border border-slate-300 px-3 py-2 text-slate-900"
                        >
                            <option value="">— select —</option>
                            {clients.map((c) => (
                                <option key={c.id} value={c.id}>
                                    #{c.id} {c.name} — {c.address}
                                </option>
                            ))}
                        </select>
                    </label>

                    {addressWarning && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                            <p className="text-sm font-medium text-amber-900">
                                The client's address could not be located on the map
                            </p>
                            <p className="mt-1 text-xs text-amber-800">
                                Enter a delivery address for this order, or leave it and fix
                                the client record later.
                            </p>
                            <input
                                type="text"
                                value={overrideAddress}
                                onChange={(e) => setOverrideAddress(e.target.value)}
                                placeholder="e.g. Calea Aradului, Timisoara"
                                className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-slate-900"
                            />
                        </div>
                    )}

                    <div className="flex flex-wrap gap-4">
                        <label className="flex flex-col text-sm text-slate-600">
                            Delivery week
                            <input
                                type="date"
                                value={week}
                                onChange={(e) => setWeek(e.target.value)}
                                className="mt-1 rounded border border-slate-300 px-3 py-2 text-slate-900"
                            />
                        </label>

                        <label className="flex flex-col text-sm text-slate-600">
                            Amount (RON)
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="85.50"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="mt-1 rounded border border-slate-300 px-3 py-2 text-slate-900"
                            />
                        </label>
                    </div>
                </div>

                <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-slate-900">Time windows</h2>
                        <button
                            onClick={addWindow}
                            className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                        >
                            + Add window
                        </button>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                        The order is delivered in exactly one of these windows.
                    </p>

                    <div className="mt-4 space-y-3">
                        {windows.map((w) => (
                            <div
                                key={w.key}
                                className="flex flex-wrap items-end gap-3 rounded border border-slate-200 p-3"
                            >
                                <label className="flex flex-col text-xs text-slate-500">
                                    Day
                                    <select
                                        value={w.day}
                                        onChange={(e) =>
                                            updateWindow(w.key, {
                                                day: e.target.value as DeliveryDay,
                                            })
                                        }
                                        className="mt-1 rounded border border-slate-300 px-2 py-2 text-sm text-slate-900"
                                    >
                                        {DAYS.map((d) => (
                                            <option key={d.value} value={d.value}>
                                                {d.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="flex flex-col text-xs text-slate-500">
                                    From
                                    <TimeInput
                                        value={w.start_time}
                                        onChange={(v) => updateWindow(w.key, { start_time: v })}
                                    />
                                </label>

                                <label className="flex flex-col text-xs text-slate-500">
                                    To
                                    <TimeInput
                                        value={w.end_time}
                                        onChange={(v) => updateWindow(w.key, { end_time: v })}
                                    />
                                </label>

                                {windows.length > 1 && (
                                    <button
                                        onClick={() => removeWindow(w.key)}
                                        className="ml-auto rounded px-2 py-1.5 text-sm text-red-600 hover:bg-red-50"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {error && (
                    <p className="mt-4 rounded bg-red-50 px-4 py-3 text-red-700">{error}</p>
                )}

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Create order"}
                    </button>
                    <button
                        onClick={() => navigate("/orders")}
                        className="rounded border border-slate-300 px-4 py-2 text-slate-700"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}