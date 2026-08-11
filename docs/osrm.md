**OSRM - rulare locala**

OSRM imi da matricea de timpi de deplasare reali intre adrese. Ruleaza ca
un container separat, pe portul 5000. Solver-ul il apeleaza prin /table.

Imaginea e pinuita prin digest, nu prin tag:

osrm/osrm-backend@sha256:af5d4a83fb90086a43b1ae2ca22872e6768766ad5fcbb07a29ff90ec644ee409

Motivul e in ADR #17. Pe scurt: fisierele preprocesate sunt legate de build-ul
exact care le-a produs, nu de numarul de versiune. Datele facute pe 27 iulie
au fost respinse pe 3 august de acelasi tag latest, care intre timp se
actualizase. Tag-urile versionate nu ajuta nici ele, cel mai recent publicat
e v5.25.0, desi latest raporteaza v5.26.0.


**Setup (o singura data, sau dupa update de harta)**

Descarci extractul de pe download.geofabrik.de/europe/romania.html in
solver/osrm-data/. Fisierul curent: romania-260726.osm.pbf, ~325 MB.

Apoi preprocesare in trei pasi, din solver/:

docker run --rm -v ${PWD}\osrm-data:/data osrm/osrm-backend@sha256:af5d4a83fb90086a43b1ae2ca22872e6768766ad5fcbb07a29ff90ec644ee409 osrm-extract -p /opt/car.lua /data/romania-260726.osm.pbf
docker run --rm -v ${PWD}\osrm-data:/data osrm/osrm-backend@sha256:af5d4a83fb90086a43b1ae2ca22872e6768766ad5fcbb07a29ff90ec644ee409 osrm-partition /data/romania-260726.osrm
docker run --rm -v ${PWD}\osrm-data:/data osrm/osrm-backend@sha256:af5d4a83fb90086a43b1ae2ca22872e6768766ad5fcbb07a29ff90ec644ee409 osrm-customize /data/romania-260726.osrm

osrm-extract parseaza OSM-ul si construieste graful edge-expanded, dupa profilul
car.lua. osrm-partition il imparte in celule ierarhice, necesar pentru MLD.
osrm-customize calculeaza metricile pe celule.

Dureaza ~3 minute in total. Extract-ul are nevoie de ~2,5 GB RAM. Daca procesul
e omorat fara eroare clara, maresti limita din Docker Desktop, Settings, Resources.

Rezultatul e ~25 de fisiere romania-260726.osrm.*, in jur de 1 GB. Nu se
commiteaza, osrm-data/ e in .gitignore.


**Pornire (de fiecare data cand lucrez)**

Din radacina repo-ului:

docker compose --profile osrm up -d osrm
docker compose logs osrm

Astept in loguri "running and waiting for requests". Incarcarea datelor MLD
dureaza cateva secunde dupa ce porneste containerul, deci daca dau logs imediat
vad doar primele linii.

Profilul osrm exista ca sa pot rula docker compose up simplu, fara sa fie
nevoie de datele de harta.

Manual, fara compose, din solver/:

docker run -d --name osrm -p 5000:5000 -v ${PWD}\osrm-data:/data osrm/osrm-backend@sha256:af5d4a83... osrm-routed --algorithm mld --max-table-size 1000 /data/romania-260726.osrm

--max-table-size 1000 e obligatoriu, vezi ADR #15. Limita implicita de 100 de
coordonate respinge cererile la scara reala, cu atat mai mult dupa duplicarea
nodurilor pentru ferestre multiple.


**Verificare**

In browser:

http://localhost:5000/table/v1/driving/21.2315,45.7471;21.2200,45.7500?annotations=duration

Daca raspunde cu code Ok si o matrice, merge.

Doua lucruri de tinut minte: ordinea e lon,lat, nu invers, pentru ca OSRM
foloseste conventia GeoJSON. Si duratele vin in secunde, conversia in minute
o fac in osrm.service.ts.


**Erori pe care le-am intalnit**

"Fingerprint did not match" inseamna ca datele au fost preprocesate cu alt
build decat cel care ruleaza acum. Se rezolva doar reprocesand cu imaginea
pinuita prin digest.

"Required files are missing" inseamna prefix gresit in calea .osrm. Verific
numele real cu Get-ChildItem osrm-data -Filter *.osrm.properties. Ce dau in
comanda e prefixul plus .osrm, nu un fisier anume.

code "TooBig" apare peste 100 de coordonate daca am uitat --max-table-size.

ERR_CONNECTION_REFUSED inseamna ca nu ruleaza containerul, sau ca Docker
Desktop e inchis.

"Container name already in use" apare cand a ramas un container mort cu acelasi
nume. docker rm -f osrm si il pornesc din nou.


**Cifre din preprocesare (extract Romania, 26.07.2026)**

De folosit in capitolul 3, la infrastructura:

Intrare bruta 40,3 mil. noduri, 4,2 mil. cai, 19448 restrictii de viraj.
Dupa compresie 6,57 mil. noduri si 2,19 mil. muchii node-based. Graful
edge-expanded are 4,16 mil. muchii. Ierarhia MLD are 4 niveluri de celule,
10819 la nivelul 1, apoi 811, 52 si 4.

Timpi: ~100 s extract, ~33 s partition, ~7 s customize. RAM de varf 2,47 GB
la extract, 1,04 GB la partition, 569 MB la customize.