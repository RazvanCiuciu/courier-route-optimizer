**Decizii de arhitectura**



Format: ce am decis, ce sau de ce am respins.



**#1. Ferestre orare goale = client disponibil oricand**



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



