**# Contract solver — POST /solve**



Solver-ul primeste o problema de rutare (locatii, ferestre orare, timpi de deplasare,

vehicule cu programele lor) si intoarce ordinea optima a opririlor per vehicul,

cu orele estimate de sosire. Nu stie nimic de baza de date sau de clienti.



Un "vehicul" poate reprezenta un curier, o dubă, SAU o zi de livrare

(vezi decisions.md: modelarea multi-zi).



**## Request**



{

&#x20; "vehicles": \[

&#x20;   { "id": 0, "shift\_start": 540,  "shift\_end": 1290 },   // joi 9:00-21:30

&#x20;   { "id": 1, "shift\_start": 1980, "shift\_end": 2730 }    // vineri (joi + 1440)

&#x20; ],

&#x20; "start\_location\_index": 0,        // depozitul, comun tuturor vehiculelor

&#x20; "locations": \[

&#x20;   {

&#x20;     "index": 0,

&#x20;     "time\_windows": \[{ "start": 540, "end": 2730 }],

&#x20;     "service\_time\_min": 0

&#x20;   },

&#x20;   {

&#x20;     "index": 1,                    // client "doar joi"

&#x20;     "time\_windows": \[{ "start": 540, "end": 1290 }],

&#x20;     "service\_time\_min": 5

&#x20;   },

&#x20;   {

&#x20;     "index": 2,                    // client "joi SAU vineri" - doua ferestre

&#x20;     "time\_windows": \[

&#x20;       { "start": 540,  "end": 1290 },

&#x20;       { "start": 1980, "end": 2730 }

&#x20;     ],

&#x20;     "service\_time\_min": 3

&#x20;   }

&#x20; ],

&#x20; "travel\_time\_matrix": \[

&#x20;   \[0, 12, 7],

&#x20;   \[12, 0, 9],

&#x20;   \[7, 9, 0]

&#x20; ]

}



**## Response**



{

&#x20; "routes": \[

&#x20;   {

&#x20;     "vehicle": 0,

&#x20;     "stops": \[{"index": 4, "eta": 550}, {"index": 1, "eta": 555}],

&#x20;     "total\_time\_min": 23,

&#x20;     "window\_violations": 0

&#x20;   },

&#x20;   {

&#x20;     "vehicle": 1,

&#x20;     "stops": \[{"index": 5, "eta": 2000}, {"index": 2, "eta": 2006}, {"index": 3, "eta": 2013}],

&#x20;     "total\_time\_min": 39,

&#x20;     "window\_violations": 0

&#x20;   }

&#x20; ],

&#x20; "dropped": \[],

&#x20; "total\_time\_min": 62

}



**## Reguli**



1\. Fiecare locatie are MINIM o fereastra explicita. Traducerea "fara preferinte"

&#x20;  o face backend-ul: cate o fereastra per zi/vehicul disponibil (vezi decisions.md #1).

2\. Timpul: minute de la un moment zero comun. Pentru multi-zi, ziua N incepe la N\*1440.

&#x20;  Fara Date, fara timezone.

3\. Solver-ul NU vorbeste cu OSRM - matricea vine in request.

4\. Locatiile sunt indecsi in matrice; maparea index <-> comanda e a backend-ului.

5\. "dropped" poate fi ne-gol: renuntare eleganta prin disjunctions.

6\. Un vehicul lucreaza EXCLUSIV in fereastra lui (start SI end constranse).

&#x20;  Asta leaga vehiculul de zi in modelarea multi-zi.

