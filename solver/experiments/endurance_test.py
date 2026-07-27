import random
import requests
from time import perf_counter

from main import SolveRequest, solve_with_ortools, compute_route

random.seed(42)  # reproductibil - aceleasi coordonate la fiecare rulare

# coordonate random in zona Timisoara + imprejurimi
N = 45
coords = [
    (random.uniform(45.70, 45.80), random.uniform(21.15, 21.35))
    for _ in range(N)
]
# coords[0] devine depozitul prin conventie - nu are semnificatie speciala geografic,
# doar e primul din lista, si SolveRequest.courier.start_location_index = 0

# cerere catre OSRM /table
# OSRM vrea coordonatele ca "lon,lat;lon,lat;..."
coord_str = ";".join(f"{lon},{lat}" for lat, lon in coords)
url = f"http://localhost:5000/table/v1/driving/{coord_str}"

t0 = perf_counter()
response = requests.get(url)
print(f"OSRM /table: {perf_counter() - t0:.3f}s pentru {N} locatii")

data = response.json()
if data["code"] != "Ok":
    raise RuntimeError(f"OSRM a esuat: {data['code']}")

#matricea, din secunde (OSRM) in minute 
durations = data["durations"]
matrix_minutes = [
    [round(sec / 60) for sec in row]
    for row in durations
]

# genereaza locatiile cu ferestre, in stilul testului de 10 
# index 0 = depot, restul = clienti cu profil variat de ferestre
locations = []
for i in range(N):
    if i == 0:
        windows = [{"start": 540, "end": 1290}]  # depot: tot programul
        service = 0
    elif i % 7 == 0:
        # 1 din 7: fereastra multipla (cazul "dimineata SAU seara")
        windows = [{"start": 545, "end": 720}, {"start": 1020, "end": 1200}]
        service = 5
    elif i % 5 == 0:
        # 1 din 5: fereastra stransa
        windows = [{"start": 600 + i, "end": 660 + i}]
        service = 3
    elif i % 3 == 0:
        # 1 din 3: seara tarziu
        windows = [{"start": 1020, "end": 1140}]
        service = 5
    else:
        # restul: flexibili, "oricand"
        windows = [{"start": 540, "end": 1290}]
        service = 2

    locations.append({
        "index": i,
        "time_windows": windows,
        "service_time_min": service
    })

#construieste request-ul si ruleaza solver-ul cronometrat
request_json = {
    "courier": {"shift_start": 540, "shift_end": 1290, "start_location_index": 0},
    "locations": locations,
    "travel_time_matrix": matrix_minutes,
    "num_vehicles": 1
}

req = SolveRequest(**request_json)

t0 = perf_counter()
order, dropped = solve_with_ortools(req)
print(f"OR-Tools solve: {perf_counter() - t0:.3f}s")

stops, total, violations = compute_route(order, req)

print("\nToate comenzile initiale:")
for loc in locations:
    windows_str = ", ".join(f"({w['start']}-{w['end']})" for w in loc["time_windows"])
    print(f"  client {loc['index']:2d}  fereastra: {windows_str}  service: {loc['service_time_min']}")

print(f"Locatii: {N} | Vizitate: {len(order)} | Dropped: {len(dropped)}")
print(f"Total time: {total} min | Ferestre incalcate: {violations}")
print(f"Dropped clients: {dropped}")

print("\nTraseu:")
for stop in stops:
    print(f"  client {stop['index']:2d}  eta {stop['eta']:4d}")