import json
import sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

LABELS = {
    "manual": "Ordine manuala",
    "nearest_neighbor": "Nearest neighbor",
    "nn_2opt": "NN + 2-opt",
    "ortools": "OR-Tools (VRPTW)",
}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def plot_routes(data, out_path):
    coords = data["coords"]
    results = data["results"]

    fig, axes = plt.subplots(1, len(results), figsize=(4.2 * len(results), 4.4))
    if len(results) == 1:
        axes = [axes]

    for ax, m in zip(axes, results):
        path = [0] + m["order"] + [0]
        xs = [coords[i]["lon"] for i in path]
        ys = [coords[i]["lat"] for i in path]

        ax.plot(xs, ys, "-", linewidth=0.9, color="#334155", zorder=1)
        ax.scatter(xs[1:-1], ys[1:-1], s=18, color="#0ea5e9", zorder=2)
        ax.scatter([coords[0]["lon"]], [coords[0]["lat"]],
                   s=90, marker="s", color="#dc2626", zorder=3)

        ax.set_title(
            f'{LABELS.get(m["method"], m["method"])}\n'
            f'{m["stops"]} opriri, {m["total_time_min"]} min, '
            f'{m["window_violations"]} incalcari',
            fontsize=10,
        )
        ax.set_xlabel("longitudine", fontsize=8)
        ax.set_ylabel("latitudine", fontsize=8)
        ax.tick_params(labelsize=7)
        ax.set_aspect("equal", adjustable="datalim")

    plt.tight_layout()
    plt.savefig(out_path, dpi=160)
    plt.close()
    print(f"scris {out_path}")


def plot_windows(data, out_path):
    windows = data["windows"]
    results = data["results"]

    fig, axes = plt.subplots(1, len(results), figsize=(4.2 * len(results), 5.2),
                             sharey=True)
    if len(results) == 1:
        axes = [axes]

    for ax, m in zip(axes, results):
        order = m["order"]
        etas = {s["index"]: s["eta"] for s in m["stops_detail"]} \
            if "stops_detail" in m else {}

        for row, node in enumerate(order):
            for w in windows[node]:
                ax.hlines(row, w["start"] / 60, w["end"] / 60,
                          color="#cbd5e1", linewidth=5, zorder=1)

            eta = etas.get(node)
            if eta is None:
                continue

            inside = any(w["start"] <= eta <= w["end"] for w in windows[node])
            ax.scatter(eta / 60, row, s=14, zorder=2,
                       color="#059669" if inside else "#dc2626")

        ax.set_title(
            f'{LABELS.get(m["method"], m["method"])}\n'
            f'{m["window_violations"]} incalcari',
            fontsize=10,
        )
        ax.set_xlabel("ora", fontsize=8)
        ax.tick_params(labelsize=7)
        ax.grid(axis="x", alpha=0.25)

    axes[0].set_ylabel("pozitia in ruta", fontsize=8)
    plt.tight_layout()
    plt.savefig(out_path, dpi=160)
    plt.close()
    print(f"scris {out_path}")


def main():
    if len(sys.argv) < 3:
        print("utilizare: python plot_comparison.py <fisier.json> <nume>")
        sys.exit(1)

    data = load(sys.argv[1])
    name = sys.argv[2]

    plot_routes(data, f"experiments/routes-{name}.png")

    if "stops_detail" in data["results"][0]:
        plot_windows(data, f"experiments/windows-{name}.png")
    else:
        print("lipsesc detaliile per oprire; a doua figura nu se poate desena")


if __name__ == "__main__":
    main()