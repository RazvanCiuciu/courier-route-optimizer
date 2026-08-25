const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);
const MINUTES = ["00", "15", "30", "45"];

export default function TimeSelect({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    const [h = "09", m = "00"] = value.split(":");

    return (
        <div className="mt-1 flex gap-1">
            <select
                value={h}
                onChange={(e) => onChange(`${e.target.value}:${m}`)}
                className="rounded border border-slate-300 px-2 py-2 text-slate-900"
            >
                {HOURS.map((hour) => {
                    const hh = String(hour).padStart(2, "0");
                    return (
                        <option key={hh} value={hh}>
                            {hh}
                        </option>
                    );
                })}
            </select>
            <span className="self-center text-slate-400">:</span>
            <select
                value={m}
                onChange={(e) => onChange(`${h}:${e.target.value}`)}
                className="rounded border border-slate-300 px-2 py-2 text-slate-900"
            >
                {MINUTES.map((min) => (
                    <option key={min} value={min}>
                        {min}
                    </option>
                ))}
            </select>
        </div>
    );
}
