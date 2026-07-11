**Contract solver - POST/solver**



Solver-ul primeste o zi de livrari (locatii, ferestre orare, timpi de deplasare) si intoarce ordinea optima a opririlor cu orele estimate de sosire. Nu stie nimic de baza de date sau de clienti, primeste totul prin request.





**# Request**



{

&#x20; "courier": {

&#x20;   "shift\_start": 540,          // minute de la miezul noptii (9:00)

&#x20;   "shift\_end": 1140,           // 19:00

&#x20;   "start\_location\_index": 0    // pleaca de la depozit = locatia 0

&#x20; },

&#x20; "locations": \[

&#x20;   {

&#x20;     "index": 0,                // pozitia in matrice — depozitul

&#x20;     "time\_windows": \[{ "start": 540, "end": 1140 }],

&#x20;     "service\_time\_min": 0

&#x20;   },

&#x20;   {

&#x20;     "index": 1,                // = comanda #207, dar solver-ul nu stie asta

&#x20;     "time\_windows": \[

&#x20;       { "start": 545, "end": 660 },

&#x20;       { "start": 1020, "end": 1140 }

&#x20;     ],

&#x20;     "service\_time\_min": 5

&#x20;   },

&#x20;   {

&#x20;     "index": 2,                // client "oricand" — fereastra tradusa explicit

&#x20;     "time\_windows": \[{ "start": 540, "end": 1140 }],

&#x20;     "service\_time\_min": 3

&#x20;   }

&#x20; ],

&#x20; "travel\_time\_matrix": \[        // minute, matrix\[i]\[j] = de la i la j

&#x20;   \[0, 12, 7],

&#x20;   \[12, 0, 9],

&#x20;   \[7, 9, 0]

&#x20; ],

&#x20; "num\_vehicles": 1

}



**# Response**



{

&#x20; "routes": \[

&#x20;   {

&#x20;     "vehicle": 0,

&#x20;     "stops": \[

&#x20;       { "index": 0, "eta": 540 },       // plecare depozit 9:00

&#x20;       { "index": 2, "eta": 547 },       // sosire 9:07

&#x20;       { "index": 1, "eta": 559 }        // sosire 9:19 (7+3 serviciu+9 drum)

&#x20;     ]

&#x20;   }

&#x20; ],

&#x20; "dropped": \[],                 // indecsii comenzilor care nu incap in zi

&#x20; "total\_time\_min": 34

}



**# Reguli**



1\. Fiecare locatie are MINIM o fereastra explicita. Traducerea "fara ferestre

&#x20;  = oricand" o face backend-ul inainte de request (vezi decisions.md #1).

2\. Timpul: minute de la miezul noptii, intregi. Fara Date, fara timezone.

3\. Solver-ul NU vorbeste cu OSRM — matricea vine in request. Backend-ul e

&#x20;  orchestratorul (DB -> OSRM -> solver).

4\. Locatiile sunt indecsi in matrice, nu id-uri de comenzi. Maparea

&#x20;  index <-> comanda e responsabilitatea backend-ului.

5\. "dropped" poate fi ne-gol: solver-ul renunta elegant la ce nu incape

&#x20;  (disjunctions), nu esueaza tot request-ul.



