# Rezultate experimentale

Doua instante generate determinist (seed 42), rulate pe aceeasi zi de livrare
(joi), cu program 09:00-20:00 si timp de servire 13 min per oprire.
Matricea de timpi provine din OSRM, pe extractul Romania.

Timp total = condus + asteptare + servire. Servirea este 13 min x numarul de
opriri programate, deci difera intre metode care programeaza numere diferite
de comenzi.

## Instanta A - cerere uniforma (30 comenzi)

Ferestre distribuite ciclic, cate 5 pe fiecare din cele 6 intervale de doua ore.

| Metoda | Opriri | Timp total (min) | Condus (min) | Asteptare (min) | Ferestre incalcate | Timp calcul (ms) |
|---|---|---|---|---|---|---|
| Ordine manuala | 30 | 1228 | 406 | 432 | 24 | 0 |
| NN cu ferestre | 30 | 1079 | 166 | 523 | 21 | 0,28 |
| NN + 2-opt cu ferestre | 30 | 956 | 191 | 375 | 17 | 19,61 |
| OR-Tools (VRPTW) | 28 | 716 | 234 | 118 | 0 | 162,58 |

Comenzi neprogramate de OR-Tools: 2

## Instanta B - cerere aglomerata (45 comenzi)

Ferestre alese aleator, cu concentrare in intervalele de dimineata:
12 comenzi 09-11, 10 comenzi 10-12, 12 comenzi 12-14, 5 comenzi 14-16,
13 comenzi 16-18, 8 comenzi 18-20.

| Metoda | Opriri | Timp total (min) | Condus (min) | Asteptare (min) | Ferestre incalcate | Timp calcul (ms) |
|---|---|---|---|---|---|---|
| Ordine manuala | 45 | 1732 | | | 42 | 0 |
| NN cu ferestre | 45 | 1363 | | | 36 | |
| NN + 2-opt cu ferestre | 45 | 1249 | | | 30 | |
| OR-Tools (VRPTW) | 33 | 698 | | | 0 | |

Comenzi neprogramate de OR-Tools: 12

## Observatii

**Reducerea timpului total fata de ordinea manuala:** 41,7% pe instanta A,
59,7% pe instanta B.

**Ruta cea mai scurta ca distanta nu este cea mai rapida.** Pe instanta A,
NN cu ferestre conduce cel mai putin dintre toate metodele (166 min, cu 59%
sub ordinea manuala), dar asteapta cel mai mult (523 min, mai mult decat
ordinea manuala). Fiind greedy, grupeaza strans geografic si ajunge devreme
peste tot, iar castigul de deplasare se pierde in asteptare. OR-Tools conduce
cu 41% mai mult decat NN (234 min), dar asteapta de peste patru ori mai putin
(118 min), rezultand cu 34% mai putin timp total.

**Verificarea fezabilitatii temporale ajuta, dar nu e suficienta.** Euristicile
care filtreaza clientii la care nu se mai poate ajunge in fereastra reduc
incalcarile de la 24 la 21, respectiv 17 pe instanta A. Raman insa 17 livrari
in afara intervalului promis, fata de zero la OR-Tools. Cauza este natura
greedy: decizia luata la pasul 5 nu poate fi revizuita cand se dovedeste
costisitoare la pasul 20.

**2-opt aduce un castig moderat.** Imbunatateste solutia NN cu 11,4% pe
instanta A. Castigul e mai mic decat in TSP clasic deoarece componenta
dominanta a duratei nu este timpul de condus, ci asteptarea impusa de ferestre.
Interesant, varianta cu 2-opt conduce mai mult decat NN pur (191 fata de 166
min) dar asteapta considerabil mai putin (375 fata de 523), ceea ce confirma
ca obiectivul lexicografic - intai incalcarile, apoi durata - reorganizeaza
ruta in favoarea respectarii ferestrelor.

**Comparatia nu este directa in privinta numarului de comenzi.** Euristicile
programeaza toate comenzile, OR-Tools 93% pe instanta A si 73% pe B, dar fara
nicio incalcare. Formularea corecta este ca OR-Tools livreaza mai putine
comenzi, insa toate in intervalul promis, in timp ce euristicile livreaza tot,
cu 57% (A) si 67% (B) dintre livrari in afara ferestrei. Intr-un context real,
o livrare in afara ferestrei inseamna un client negasit acasa, deci o livrare
esuata, nu una realizata cu intarziere.

**Timpul de calcul ramane practicabil.** 163 ms pe instanta A si 253 ms pe B,
suficient pentru reoptimizare in timpul zilei de livrare.