export default function TimeInput({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

    function handleChange(raw: string) {
        const digits = raw.replace(/\D/g, "").slice(0, 4);
        if (digits.length <= 2) {
            onChange(digits);
            return;
        }
        onChange(`${digits.slice(0, 2)}:${digits.slice(2)}`);
    }

    return (
        <input
            type="text"
            inputMode="numeric"
            placeholder="17:00"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className={`mt-1 w-24 rounded border px-3 py-2 text-center text-slate-900 ${
                valid ? "border-slate-300" : "border-red-400 bg-red-50"
            }`}
        />
    );
}