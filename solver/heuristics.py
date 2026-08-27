def nearest_neighbor_tw(matrix, depot, clients, windows, service_time, shift_start):
    unvisited = set(clients)
    current = depot
    current_time = shift_start
    order = []

    while unvisited:
        feasible = []
        for n in unvisited:
            arrival = current_time + matrix[current][n]
            # exista macar o fereastra inca deschisa la sosire?
            if any(arrival <= w[1] for w in windows[n]):
                feasible.append(n)

        candidates = feasible if feasible else list(unvisited)
        nearest = min(candidates, key=lambda n: matrix[current][n])

        arrival = current_time + matrix[current][nearest]
        # asteapta daca ajunge inainte de deschidere
        starts = [w[0] for w in windows[nearest] if w[1] >= arrival]
        service_start = max(arrival, min(starts)) if starts else arrival

        order.append(nearest)
        unvisited.remove(nearest)
        current_time = service_start + service_time
        current = nearest

    return order

def count_violations(order, matrix, depot, windows, service_time, shift_start):
    current = depot
    current_time = shift_start
    violations = 0

    for n in order:
        arrival = current_time + matrix[current][n]
        open_windows = [w for w in windows[n] if w[1] >= arrival]

        if not windows[n]:
            service_start = arrival
        elif not open_windows:
            violations += 1
            service_start = arrival
        else:
            service_start = max(arrival, min(w[0] for w in open_windows))

        current_time = service_start + service_time
        current = n

    return violations

def route_duration(order, matrix, depot):
    if not order:
        return 0

    total = matrix[depot][order[0]]
    for i in range(len(order) - 1):
        total += matrix[order[i]][order[i + 1]]
    total += matrix[order[-1]][depot]

    return total


def two_opt_tw(order, matrix, depot, windows, service_time, shift_start,
               max_iterations=200):
    best = list(order)
    best_viol = count_violations(best, matrix, depot, windows, service_time, shift_start)
    best_cost = route_duration(best, matrix, depot)
    iterations = 0
    improved = True

    while improved and iterations < max_iterations:
        improved = False
        iterations += 1

        for i in range(len(best) - 1):
            for j in range(i + 1, len(best)):
                candidate = best[:i] + best[i:j + 1][::-1] + best[j + 1:]

                viol = count_violations(candidate, matrix, depot, windows,
                                        service_time, shift_start)
                cost = route_duration(candidate, matrix, depot)

                # lexicografic: intai incalcarile, apoi durata
                if (viol, cost) < (best_viol, best_cost):
                    best = candidate
                    best_viol = viol
                    best_cost = cost
                    improved = True

    return best


def manual_order(clients):
    return list(clients)