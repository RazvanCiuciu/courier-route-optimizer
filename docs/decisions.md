**Decizii de arhitectura**



Format: ce am decis, ce sau de ce am respins.



**#1. Ferestre orare goale = client disponibil oricand**

**\[SUPERSEDED de #16, la introducerea multi-zi]**



Un client fara *timeWindows* poate primi oricand, nu niciodata. Alternativa (gol = imposibil de vizitat) ar bloca livrarea. In solver: se traduce in fereastra explicita:

inceput-program -> sfarsit program





**#2. Granite inclusive**



*now >= start \&\& now <= end* -> o fereastra "9:00-11:00" include ambele capete.

Consecinta: o fereastra e ori activa, ori viitoare, niciodata ambele.



**#3.** ***canTransition* primeste starea intreaga, no doar kind-ul.**



Acest aspect de dat datorita lui *not\_home,* unde avem 3 rezolutii : *cancelled, rescheduled\_other\_day, rescheduled\_today.* Din *not\_home* putem face tranzitia doar daca rezolutia sa este *rescheduled\_today,* motiv pentru care este nevoie de intreaga stare.



**#4. Whitelist la tranzitii.**



*=== "rescheduled\_today"*, nu *!== "cancelled" .* Decizie data pentru posibilitatea rezolutilor introduse pe viitor, care au nevoie de scenarii specifice de tranzitie.



**#5. Status separat de Order**



Order reprezinta fapte imuabile, in timp ce statusul reprezinta o stare ce evolueaza.



**#6. Infinity la sortarea clientilor fara ferestre**



Comporament rezultat din *Math.min()* pe array gol. *sortByEarliestWindow()* o sa imi returneze un array cu comenzile ordonate in functie de start, cu toate comenzile care pot fii duse oricand la final.



**#7 Python 3.13 pentru solver**



Intervalul suportat de OR-Tools : (3.9-3.13). Evitat 3.14, instalat din store, fara wheels OR-Tools garantate.



**#8 Evaluator separat pentru solver**



compute\_route(order, request) evaluaza orice permutare. Ordinea este produsa de endpoint( OR-Tools pe viitor, pentru testare s-a trimis un ecou).Separarea permite ca acelasi evaluator sa serveasca mai multe solutii: OR-Tools în productie, NN/2-opt/ordinea manuala în experiment.



**#9 Compute\_route acum respecta ferestrele**



Asteapta la sosire devreme, numara violations daca toate ferestrele s-au inchis.



**#10 Axa de timp este continua pentru multi-zi**



ziua N incepe N\*1440; joi = 540-1290, vineri = 1980-2730. Alternativa respinsa: camp separat "zi" per comanda (ar fi mutat partionarea in afara solver-lui)



**#11 Legarea vehicul/zi necesita ambele capete**



Start si end contranse. Cu slack mare, Start sigur permite vehiculului sa traverseze in ziua urmatoare. Bug observat (vehiculul de joi livra vineri dupa 24h de asteptare)



**#12 Contract v2**



*vehicle\[]* in loc *courier + num\_vehicles*; *start\_location\_index* mutat la nivel de request mutat la nivel de request (depozit comun); metrici per ruta + agregat global. Motivul: un

"vehicul" poate fi un curier sau o zi de livrare



**#13 Capacitate per vehicul** 



dimensiune "count", *max\_stops* cu default 60. Alternativa respinsa: echilibrare fortata intre zile (artificiala, realitatea are capacitatea maxima, nu cerinta de egalitate)



**#14 Limita *total\_time\_min***



masoara durata turei incluzand asteptarile, nu timpul de condus si nici ora de terminare. De revizitat: adaugat *finish\_time* in raspuns + returul la depot in *compute\_route* (bug identificat azi, nereparat)



**#15 *--max-table-size 1000* la pornirea OSRM**



limita implicita respinge cereri > 100 coordonate.



**#16 Traducerea "fara preferinte" cu multi-zi**



Inlocuieste #1. Cu axa de timp pe mai multe zile, "oricand" nu mai poate fi

o singura fereastra (ar include si noaptea dintre zile). Backend-ul traduce

in cate o fereastra per zi disponibila: *\[(joi\_start, joi\_end), (vineri\_start, vineri\_end)]*.

Solver-ul cere minim o fereastra explicita per locatie; nu mai accepta lista goala.

Alternativa respinsa: solver-ul sa primeasca "delivery\_days" si sa expandeze singur

(ar fi complicat contractul si ar fi mutat cunoasterea zilelor in solver).




