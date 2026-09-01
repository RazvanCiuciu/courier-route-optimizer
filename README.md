# Optimizarea rutelor de livrare cu ferestre de timp multiple

Aplicatie de optimizare a rutelor de livrare, dezvoltata pentru un serviciu
real de livrari de peste proaspat din Timisoara. Rezolva o problema de tip
VRPTW (Vehicle Routing Problem with Time Windows), cu suport pentru ferestre
de timp multiple per client si rerutare in timp real.

Proiect realizat in cadrul lucrarii de licenta, Universitatea Politehnica
Timisoara.

## Ce face aplicatia

- genereaza rute optimizate pentru doua zile de livrare (joi si vineri),
  respectand ferestrele orare comunicate de clienti
- suporta clienti cu mai multe ferestre alternative (ex: joi dimineata SAU
  vineri dupa-amiaza), prin duplicarea nodurilor in solver
- recalculeaza traseul ramas in timpul zilei, pornind din pozitia curenta a
  curierului, cand un client cere alta ora sau alta adresa
- ofera o interfata separata pentru curier (o oprire pe ecran, optimizata
  pentru telefon) si pentru operator (introducerea comenzilor, generarea
  rutelor)
- inregistreaza plata mixta (numerar / transfer) pentru inchiderea de zi

## Arhitectura

```
Interfata (React)  -->  Backend (Node.js + Express)  -->  Solver (Python + OR-Tools)
                              |                                    |
                         PostgreSQL                          OSRM (timpi de deplasare)
                              |
                         Nominatim (geocodare adrese)
```

Detalii complete in `docs/backend.md` si in capitolul 4 al documentatiei.

## Rulare

Necesita Docker si Docker Compose instalate.

```bash
git clone https://github.com/RazvanCiuciu/courier-route-optimizer.git
cd courier-route-optimizer
docker compose --profile osrm up -d
```

Aplicatia devine disponibila pe `http://localhost:5173`.

Prima pornire dureaza cateva minute, cat se construiesc imaginile. Serviciul
OSRM are nevoie de date de harta preprocesate — vezi `docs/osrm.md` pentru
pasii de preprocesare, necesari o singura data.

Fara datele OSRM, aplicatia poate rula si fara profilul `osrm`:

```bash
docker compose up -d
```

In acest caz, calculul timpilor de deplasare va esua; util doar pentru
explorarea interfetei si a modelului de date.

### Rulare in dezvoltare

Pentru reincarcare automata la modificari de cod, backend-ul si interfata
se ruleaza local, in afara containerelor:

```bash
docker compose stop backend frontend

cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

Restul serviciilor (baza de date, solver, OSRM) raman in containere.

## Structura repository-ului

```
solver/          solver VRPTW (Python + OR-Tools)
backend/          API REST (Node.js + TypeScript + Express)
frontend/         interfata (React + Vite + Tailwind)
db/               schema PostgreSQL
docs/             documentatie tehnica (arhitectura, decizii, ghid backend)
experiments/      scripturi si rezultate ale evaluarii experimentale
```

## Documentatie

- `docs/backend.md` — ghid de pornire, arhitectura pe straturi, endpoint-uri
- `docs/solver.md` — contractul solver-ului (POST /solve)
- `docs/osrm.md` — pregatirea si rularea serviciului de rutare
- `docs/decisions.md` — decizii de arhitectura, in format ADR

## Evaluare experimentala

Rezultatele compararii intre patru metode de rutare (ordonare manuala pe
zone, nearest neighbor, nearest neighbor cu 2-opt, si solver-ul VRPTW) se
gasesc in `experiments/results.md`, impreuna cu scripturile care genereaza
instantele de test si figurile.

## Stadiu

Aplicatie functionala, testata pe date generate si pe un set restrans de
date reale. Urmeaza testarea in productie, in cadrul serviciului de livrari
pentru care a fost proiectata.

## Autor

Razvan-George Ciuciu, student la Universitatea Politehnica Timisoara.
