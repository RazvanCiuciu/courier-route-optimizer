export function currentWeekStart(): string {
    const now = new Date();
    const day = now.getDay();          
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);

    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, "0");
    const d = String(monday.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}