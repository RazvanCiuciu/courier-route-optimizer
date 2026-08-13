**Decizii de arhitectura**
Format: ce am decis, ce sau de ce am respins.

**#1. Ferestre orare goale = client disponibil oricand**
**\[SUPERSEDED de #16, la introducerea multi-zi]**

Un client fara _timeWindows_ poate primi oricand, nu niciodata. Alternativa (gol = imposibil de vizitat) ar bloca livrarea. In solver: se traduce in fereastra explicita:

inceput-program -> sfarsit program

**#2. Granite inclusive**

_now >= start \&\& now <= end_ -> o fereastra "9:00-11:00" include ambele capete.
Consecinta: o fereastra e ori activa, ori viitoare, niciodata ambele.

**#3.** **_canTransition_ primeste starea intreaga, no doar kind-ul.**

Acest aspect de dat datorita lui _not_home,_ unde avem 3 rezolutii : _cancelled, rescheduled_other_day, rescheduled_today._ Din _not_home_ putem face tranzitia doar daca rezolutia sa este _rescheduled_today,_ motiv pentru care este nevoie de intreaga stare.

**#4. Whitelist la tranzitii.**

_=== "rescheduled_today"_, nu _!== "cancelled" ._ Decizie data pentru posibilitatea rezolutilor introduse pe viitor, care au nevoie de scenarii specifice de tranzitie.

**#5. Status separat de Order**

Order reprezinta fapte imuabile, in timp ce statusul reprezinta o stare ce evolueaza.

**#6. Infinity la sortarea clientilor fara ferestre**

Comporament rezultat din _Math.min()_ pe array gol. _sortByEarliestWindow()_ o sa imi returneze un array cu comenzile ordonate in functie de start, cu toate comenzile care pot fii duse oricand la final.

**#7 Python 3.13 pentru solver**

Intervalul suportat de OR-Tools : (3.9-3.13). Evitat 3.14, instalat din store, fara wheels OR-Tools garantate.

**#8 Evaluator separat pentru solver**

compute_route(order, request) evaluaza orice permutare. Ordinea este produsa de endpoint( OR-Tools pe viitor, pentru testare s-a trimis un ecou).Separarea permite ca acelasi evaluator sa serveasca mai multe solutii: OR-Tools în productie, NN/2-opt/ordinea manuala în experiment.

**#9 Compute_route acum respecta ferestrele**

Asteapta la sosire devreme, numara violations daca toate ferestrele s-au inchis.

**#10 Axa de timp este continua pentru multi-zi**

ziua N incepe N\*1440; joi = 540-1290, vineri = 1980-2730. Alternativa respinsa: camp separat "zi" per comanda (ar fi mutat partionarea in afara solver-lui)

**#11 Legarea vehicul/zi necesita ambele capete**

Start si end contranse. Cu slack mare, Start sigur permite vehiculului sa traverseze in ziua urmatoare. Bug observat (vehiculul de joi livra vineri dupa 24h de asteptare)

**#12 Contract v2**

_vehicle\[]_ in loc _courier + num_vehicles_; _start_location_index_ mutat la nivel de request mutat la nivel de request (depozit comun); metrici per ruta + agregat global. Motivul: un "vehicul" poate fi un curier sau o zi de livrare

**#13 Capacitate per vehicul**

dimensiune "count", _max_stops_ cu default 60. Alternativa respinsa: echilibrare fortata intre zile (artificiala, realitatea are capacitatea maxima, nu cerinta de egalitate)

**#14 Limita _total_time_min_**

masoara durata turei incluzand asteptarile, nu timpul de condus si nici ora de terminare. De revizitat: adaugat _finish_time_ in raspuns + returul la depot in _compute_route_ (bug identificat azi, nereparat)

**#15 _--max-table-size 1000_ la pornirea OSRM**

limita implicita respinge cereri > 100 coordonate.

**#16 Traducerea "fara preferinte" cu multi-zi**

Inlocuieste #1. Cu axa de timp pe mai multe zile, "oricand" nu mai poate fi o singura fereastra (ar include si noaptea dintre zile). Backend-ul traduce in cate o fereastra per zi disponibila: _\[(joi_start, joi_end), (vineri_start, vineri_end)]_.Solver-ul cere minim o fereastra explicita per locatie; nu mai accepta lista goala.Alternativa respinsa: solver-ul sa primeasca "delivery_days" si sa expandeze singur.
(ar fi complicat contractul si ar fi mutat cunoasterea zilelor in solver).

**#17 Imaginea OSRM pinuita prin digest, nu prin tag**

Fisierele preprocesate MLD sunt legate de build-ul exact care le-a produs, nu de numarul de versiune raportat. Datele generate pe 27 iulie cu tag-ul latest au fost respinse pe 3 august tot de latest (fingerprint mismatch), desi ambele raportau v5.26.0 - imaginea se actualizase intre timp. Nici pinuirea pe tag versionat nu ajuta: cel mai recent tag publicat e v5.25.0, deci build-ul din latest nu are tag propriu. Singura garantie e digest-ul: 
osrm/osrm-backend@sha256:af5d4a83fb90086a43b1ae2ca22872e6768766ad5fcbb07a29ff90ec644ee409 
Alternativa respinsa: incercarea succesiva de tag-uri versionate, costisitoare si fara garantie.

**#18 Straturi doar unde exista complexitate**

Backend-ul e organizat routes -> controllers -> services -> repositories, dar clientii nu au service: controller-ul apeleaza direct repository-ul. Entitatea nu are logica de business, doar CRUD, iar un strat care doar deleaga e ceremonie. Alternativa respinsa: simetria cu orders, care ar fi adaugat un fisier gol. De reevaluat daca apare validare sau geocodare automata la crearea clientului.

**#19 Ferestrele de timp apartin comenzii, nu clientului**

time_windows.order_id, nu client_id. Abonatii au tipare stabile, dar multi au exceptii saptamanale, iar reprogramarea din teren e clar la nivel de comanda. Sursa unica de adevar pentru solver. Alternative respinse: ferestre pe client (nu suporta exceptii) si varianta hibrida cu preferinte pe client copiate la creare (complexitate fara castig la 120 de clienti).

**#20 Plata modelata ca doua sume, nu ca enum de metoda**

paid_cash si paid_transfer, ambele NUMERIC(10,2), plus total_amount. Cazul mixt (parte cash, parte transfer) devine valoarea generala, nu un caz special tratat separat. Inchiderea zilei e un SUM pe fiecare coloana. Constrangeri CHECK: sumele nenegative si suma lor sub total. Alternativa respinsa: payment_method ca enum, care ar fi cerut logica separata pentru plata partiala.NUMERIC, nu float: aritmetica exacta e obligatorie pentru bani.

**#21 DATE parsat ca string, nu ca Date**

pg.types.setTypeParser(1082, val => val) in db.ts. Driverul interpreta DATE in fusul orar local si JSON.stringify il serializa in UTC, deci 2026-08-10 iesea ca 2026-08-09T21:00:00.000Z. Cu comenzi alocate pe zile, decalajul ar fi mutat livrari intre saptamani. Alternativa respinsa: conversie manuala in fiecare punct de iesire. TIMESTAMPTZ ramane neatins - acolo fusul orar chiar conteaza.

**#22 Validare pe trei niveluri**

Zod la granita API (formatul datelor), reguli de business in service (masina de stari, plata sub total), constrangeri CHECK in baza (fereastra valida, sume nenegative). Redundanta e intentionata: zod da mesaje utile clientului, service-ul exprima reguli de domeniu, baza e ultima aparare a integritatii indiferent cine scrie in ea.

**#23 PATCH /stops/:id accepta doar delivered si failed_attempt**

Schema endpoint-ului reflecta ce operatii au sens in contextul respectiv, nu tot ce e tehnic posibil. Din teren, curierul poate raporta doar ce s-a intamplat la usa; dropped si pending sunt decizii de planificare. Alternativa respinsa: reutilizarea lui changeStatusSchema, care ar fi permis stricarea starii dintr-o greseala de tastare.

**#24 Plata inregistrata dupa schimbarea statusului, fara tranzactie comuna**

changeStatus ruleaza primul pentru ca el valideaza tranzitia prin masina de stari; daca comanda e deja delivered, arunca ConflictError si nu se inregistreaza plata dubla. Daca recordPayment esueaza dupa, comanda ramane livrata si neplatita, corectabila prin PATCH /orders/:id/payment. Fereastra de inconsistenta e mica si recuperabila manual la scara unui singur curier. Alternativa respinsa: tranzactie care acopera ambele, care ar fi cerut mutarea logicii din service in repository.

**#25 Migrari amanate**

schema.sql cu DROP TABLE la inceput, rulat manual prin psql. Schema e inca instabila si nu exista date de pastrat. Alternativa respinsa: node-pg-migrate, ceremonie fara beneficiu in faza de dezvoltare. De reevaluat inainte de prima rulare cu date reale de la magazin.

**#26 Commit-ul regenereaza preview-ul in loc sa-l primeasca**

POST /routes/commit primeste doar delivery_week si ruleaza previewRoutes intern, apoi salveaza. Operatorul poate deci vedea un preview si comite altceva, daca intre timp s-a schimbat ceva (comanda noua, adresa geocodata). La un singur operator care ruleaza preview si commit in cateva secunde, riscul e teoretic. Alternativa respinsa: trimiterea intregului PreviewResult in body, care ar fi garantat ce se salveaza dar ar fi cerut validarea unui payload mare si complex.

**#27 Comenzile deja livrate sunt excluse din rutare**

previewRoutes filtreaza pending si assigned. Permite rerularea optimizarii in mijlocul zilei fara sa reprogrameze ce s-a livrat deja - baza pentru rerutarea cand clientul nu e acasa. Limitare cunoscuta, nereparata: o singura adresa pe care Nominatim nu o gaseste arunca ValidationError si blocheaza tot preview-ul. La 120 de clienti cu adrese dictate la telefon e o certitudine, nu un risc. De rezolvat prin skipped_order_ids in raspuns, in loc de aruncare.
