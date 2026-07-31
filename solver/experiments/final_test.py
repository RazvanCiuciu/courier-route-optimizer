import random
import requests
from time import perf_counter

from main import SolveRequest, solve_with_ortools, compute_route

random.seed(42)  # reproductibil - aceleasi coordonate la fiecare rulare

# coordonate random in zona Timisoara + imprejurimi
N = 120
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
        windows = [{"start": 540, "end": 2730}]      # depot
        service = 0
    elif i % 6 == 0:
        windows = [{"start": 540, "end": 1290}]      # doar JOI
        service = 4
    elif i % 6 == 1:
        windows = [{"start": 1980, "end": 2730}]     # doar VINERI
        service = 4
    elif i % 6 == 2:
        # joi dimineata SAU vineri dupa-masa - cazul real cu ferestre
        windows = [{"start": 540, "end": 780}, {"start": 2160, "end": 2500}]
        service = 5
    elif i % 6 == 3:
        windows = [{"start": 1020, "end": 1200}]     # joi seara, fereastra stransa
        service = 5
    else:
        # flexibili: oricare zi, oricand
        windows = [{"start": 540, "end": 1290}, {"start": 1980, "end": 2730}]
        service = 3

    locations.append({
        "index": i,
        "time_windows": windows,
        "service_time_min": service
    })

#construieste request-ul si ruleaza solver-ul cronometrat
request_json = {
    "vehicles": [
        {"id": 0, "shift_start": 540,  "shift_end": 1290, "max_stops": 60},
        {"id": 1, "shift_start": 1980, "shift_end": 2730, "max_stops": 60}
    ],
    "start_location_index": 0,
    "locations": locations,
    "travel_time_matrix": matrix_minutes
}

req = SolveRequest(**request_json)

t0 = perf_counter()
orders, dropped = solve_with_ortools(req)
print(f"OR-Tools solve: {perf_counter() - t0:.3f}s")

print(f"\nLocatii: {N} | Dropped: {len(dropped)}")
print(f"Dropped clients: {dropped}\n")

total_all = 0
for vehicle, order in zip(req.vehicles, orders):
    stops, total, violations = compute_route(order, req, vehicle.shift_start)
    total_all += total
    zi = "JOI" if vehicle.id == 0 else "VINERI"
    print(f"=== {zi} (vehicul {vehicle.id}) — {len(order)} clienti, {total} min, {violations} incalcari ===")
    for stop in stops:
        print(f"  client {stop['index']:3d}  eta {stop['eta']:5d}")
    print()

print(f"TOTAL ambele zile: {total_all} min")