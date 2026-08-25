import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Client } from "../types/domain";

export default function ClientsList() {
    const [clients, setClients] = useState<Client[]>([]);
    const [query, setQuery] = useState("");
    const [editId, setEditId] = useState<number | null>(null);
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [phone, setPhone] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setClients(await api.get<Client[]>("/clients"));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    function startEdit(c: Client) {
        setEditId(c.id);
        setName(c.name);
        setAddress(c.address);
        setPhone(c.phone_number);
        setError(null);
    }

    async function save() {
        if (editId === null) return;
        setBusy(true);
        setError(null);
        try {
            await api.patch(`/clients/${editId}`, {
                name: name.trim(),
                address: address.trim(),
                phone_number: phone.trim(),
            });

            try {
                await api.post(`/clients/${editId}/geocode`, {});
            } catch {
                setError("Saved, but the address could not be located on the map");
            }

            setEditId(null);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setBusy(false);
        }
    }

    const filtered = clients.filter((c) => {
        const q = query.trim().toLowerCase();
        if (q === "") return true;
        return (
            String(c.id) === q ||
            c.name.toLowerCase().includes(q) ||
            c.address.toLowerCase().includes(q)
        );
    });

    return (
        <div className="p-6">
            <div className="mx-auto max-w-2xl">
                <h1 className="text-2xl font-bold text-slate-900">Clients</h1>

                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by number, name or address"
                    className="mt-6 w-full rounded border border-slate-300 px-3 py-2 text-slate-900"
                />

                {error && (
                    <p className="mt-4 rounded bg-red-50 px-4 py-3 text-red-700">{error}</p>
                )}

                <div className="mt-4 space-y-2">
                    {filtered.map((c) => (
                        <div
                            key={c.id}
                            className="rounded-lg border border-slate-200 bg-white p-4"
                        >
                            {editId === c.id ? (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full rounded border border-slate-300 px-3 py-2"
                                    />
                                    <input
                                        type="text"
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        className="w-full rounded border border-slate-300 px-3 py-2"
                                    />
                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full rounded border border-slate-300 px-3 py-2"
                                    />
                                    <p className="text-xs text-slate-500">
                                        Changing the address clears the cached coordinates.
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={save}
                                            disabled={busy}
                                            className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                                        >
                                            {busy ? "Saving..." : "Save"}
                                        </button>
                                        <button
                                            onClick={() => setEditId(null)}
                                            className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-slate-900">
                                            <span className="font-mono text-slate-400">
                                                #{c.id}
                                            </span>{" "}
                                            {c.name}
                                        </p>
                                        <p className="truncate text-sm text-slate-500">
                                            {c.address}
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            {c.phone_number}
                                            {c.lat === null && (
                                                <span className="ml-2 text-amber-700">
                                                    not geocoded
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => startEdit(c)}
                                        className="shrink-0 rounded border border-slate-300 px-3 py-1 text-sm text-slate-700"
                                    >
                                        Edit
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}