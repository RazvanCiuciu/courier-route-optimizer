**Backend - API REST**

Node.js + TypeScript + Express + Postgres. Orchestreaza tot: tine datele,
geocodeaza adresele, cere matricea de la OSRM, trimite problema la solver si
salveaza rutele. Ruleaza local pe portul 3000, nu in container (deocamdata).


**Pornire**

Din radacina repo-ului, pentru infrastructura:

docker compose --profile osrm up -d

Porneste Postgres (5432), solver-ul (8000) si OSRM (5000). Fara --profile osrm
porneste doar db si solver, util cand nu am nevoie de matrice reala.

Apoi backend-ul, din backend/:

npm run dev

tsx watch reporneste la fiecare salvare. Test rapid: localhost:3000/health si
localhost:3000/health/db.

Daca health/db da 500, verific docker compose ps - de obicei Postgres nu ruleaza
sau Docker Desktop e inchis.


**Schema bazei de date**

Din radacina, dupa orice modificare in db/schema.sql:

docker compose cp db\schema.sql db:/tmp/schema.sql
docker compose exec db psql -U vrptw -d vrptw -f /tmp/schema.sql

Copierea e obligatorie de fiecare data - docker compose cp face o copie unica,
nu o sincronizare. Scriptul incepe cu DROP TABLE, deci sterge tot si reconstruieste
(vezi ADR #25 despre migrari).

Verificare: docker compose exec db psql -U vrptw -d vrptw -c "\dt"
Trebuie sa apara cinci tabele: clients, orders, time_windows, routes, route_stops.

psql continua dupa erori in loc sa se opreasca, deci ma uit dupa ERROR in iesire,
nu doar dupa rezultatul final. NOTICE-urile despre "does not exist, skipping"
sunt normale la prima rulare.


**Variabile de mediu**

In backend/.env (negitignorat, vezi .env.example pentru sablon):

DEPOT_LAT, DEPOT_LON - coordonatele magazinului, punctul de plecare al rutelor
DEPOT_ADDRESS - doar informativ
SHIFT_START_MIN, SHIFT_END_MIN - programul de livrare in minute de la miezul noptii
SERVICE_TIME_MIN - timpul mediu petrecut la o oprire (13, calibrat din teren)
DATABASE_URL, SOLVER_URL, OSRM_URL

dotenv/config trebuie importat PRIMUL in index.ts, inainte de app. Serviciile
citesc process.env la nivel de modul, deci daca app se incarca primul raman cu
valorile implicite.


**Structura pe straturi**

routes/       declara caile si le leaga de controllere. Fara logica.
controllers/  citesc req, valideaza cu zod, apeleaza serviciul, formateaza raspunsul.
              Nu stiu SQL.
services/     logica de business: tranzitii de stare, validari de domeniu,
              orchestrare. Nu stiu de HTTP.
repositories/ singurul loc cu SQL. Primesc si returneaza obiecte de domeniu.
types/        interfetele: Order, Client, TimeWindow, Route, RouteStop.
validation/   schemele zod.
errors.ts     AppError si subclasele; fiecare isi poarta codul HTTP.

Testul: daca as inlocui Express, s-ar schimba doar routes si controllers. Daca
as inlocui Postgres, doar repositories.

Clientii nu au service - controller-ul apeleaza direct repository-ul (ADR #18).

Erorile se propaga prin next(err) catre handler-ul central din app.ts, care le
mapeaza la coduri HTTP. E singurul loc unde se decide statusul raspunsului.
Middleware-ul de erori trebuie sa aiba PATRU parametri, altfel Express il trateaza
ca middleware obisnuit si nu se apeleaza niciodata.


**Endpoint-uri**

Clienti:
  POST   /clients              creeaza. Body: name, address, phone_number.
  GET    /clients              toti.
  GET    /clients/:id          unul.
  POST   /clients/:id/geocode  geocodeaza adresa si salveaza coordonatele.
                               A doua oara raspunde din cache, instant.

Comenzi:
  POST   /orders               creeaza comanda + ferestrele ei, intr-o tranzactie.
                               Body: client_id, delivery_week, total_amount,
                               time_windows[{day, start_time, end_time}].
  GET    /orders?week=...      comenzile saptamanii, cu ferestrele imbricate.
  GET    /orders/:id           una.
  PATCH  /orders/:id/status    schimba statusul. Valideaza tranzitia.
  PATCH  /orders/:id/day       aloca ziua, trece pe assigned.
  PATCH  /orders/:id/payment   inregistreaza plata.

Opriri:
  PATCH  /stops/:id            ce a raportat curierul la usa. Body: status
                               (delivered sau failed_attempt), optional paid_cash,
                               paid_transfer, drop_reason. Traduce in operatii pe
                               comanda (ADR #23).

Rutare:
  POST   /routes/preview       genereaza rutele fara sa scrie nimic.
                               Body: delivery_week.
  POST   /routes/commit        regenereaza si salveaza (ADR #26).

Sanatate:
  GET    /health
  GET    /health/db


**Masina de stari a comenzii**

ALLOWED_TRANSITIONS in orders.service.ts:

  pending        -> assigned, dropped
  assigned       -> delivered, failed_attempt, dropped
  failed_attempt -> assigned, dropped          (reprogramare)
  delivered      -> nimic                      (stare finala)
  dropped        -> pending                    (poate reintra la o noua rulare)

Tipul Record<OrderStatus, OrderStatus[]> forteaza exhaustivitatea: daca adaug un
status nou si uit sa-i definesc tranzitiile, nu compileaza.

Tranzitia invalida arunca ConflictError -> 409. Asta previne si incasarea dubla:
o comanda deja delivered nu mai poate fi marcata inca o data.


**Fluxul de rutare (routing.service.ts)**

previewRoutes(week):
  1. ia comenzile saptamanii cu ferestrele lor, filtreaza pending si assigned
  2. pentru fiecare comanda ia clientul si se asigura ca are coordonate
     (ensureCoordinates - din cache daca exista, altfel geocodeaza si salveaza)
  3. construieste lista de coordonate cu depozitul pe pozitia 0
  4. cere matricea de la OSRM
  5. converteste ferestrele din TIME + zi in minute pe axa continua
     (timeToMinutes: ora*60 + minut + index_zi*1440)
  6. construieste payload-ul: un vehicul per zi, cu shift-ul deplasat cu 1440
  7. trimite la solver
  8. mapeaza raspunsul inapoi: indicii solver-ului -> order_id, prin array-ul
     orderIds construit la pasul 2
  9. intoarce rezultatul FARA sa scrie in baza

commitRoutes(preview):
  intr-o tranzactie - sterge rutele anterioare ale saptamanii (route_stops cade
  prin CASCADE), insereaza rutele si opririle noi, marcheaza comenzile ca assigned
  cu ziua alocata, si comenzile din dropped ca dropped.

Depozitul primeste o fereastra larga (0 .. 2*1440) pentru ca solver-ul face
locations[i][0] pe fiecare locatie, inclusiv pe depot. Cu lista goala ar crapa
cu IndexError.

UPDATE-urile din commit au AND status = 'pending', ca sa nu retrogradeze la
assigned comenzile deja livrate daca rulez commit din nou in mijlocul zilei.


**Geocodare**

Nominatim, serviciu public, cu politica de maxim o cerere pe secunda. Throttling-ul
din geocoding.service.ts respecta 1100 ms intre cereri; fara el IP-ul e blocat.
User-Agent identificabil e tot din politica lor.

countrycodes=ro reduce ambiguitatea - "Strada Victoriei" exista in multe tari.

Cache: coordonatele se salveaza in clients.lat/lon la prima geocodare. La 120 de
clienti, diferenta e intre doua minute de asteptare la fiecare rulare si zero.

Adresa negasita arunca ValidationError -> 400. Limitare cunoscuta: blocheaza tot
preview-ul (vezi ADR #27).


**Matrice OSRM**

osrm.service.ts, endpoint /table. Doua capcane:
  - ordinea e lon,lat (conventie GeoJSON), nu lat,lon
  - duratele vin in secunde, conversia in minute se face aici, intr-un singur loc

Peste 100 de coordonate cere --max-table-size la pornirea OSRM (ADR #15).


**Testare manuala**

backend/requests.http, cu extensia REST Client din VS Code. Fiecare cerere se
separa cu ### si are un rand gol intre antete si corp - altfel corpul urmator
ajunge lipit de cererea anterioara si primesc SyntaxError de la body-parser.

Flux complet de verificat:
  creez clienti cu adrese reale din Timisoara
  creez comenzi cu ferestre variate (una doar joi, una pe ambele zile, una doar vineri)
  POST /routes/preview - verific ca ferestrele sunt respectate si ca respectiva
    comanda cu doua ferestre apare O SINGURA data (disjunctiile pe noduri gemene)
  POST /routes/commit
  verific in baza: routes committed, route_stops in ordine, orders assigned
  PATCH /stops/:id cu delivered si plata
  retrimit acelasi PATCH - trebuie 409, protectia anti-incasare-dubla

Curatare intre teste:
docker compose exec db psql -U vrptw -d vrptw -c "DELETE FROM route_stops; DELETE FROM routes; DELETE FROM orders; DELETE FROM clients;"

SERIAL nu se reseteaza la DELETE, deci id-urile continua de unde au ramas.
Atentie sa nu trimit de doua ori aceeasi cerere de creare - am pierdut timp
crezand ca e bug de mapare cand de fapt aveam doi clienti identici.
