\# 📘 Scorched Earth - JavaScript koodin analyysi



Tämä dokumentti on tekninen analyysi pelin lähdekoodista (`script.js`). Peli on vuoropohjainen tykistöstrategiapeli, joka hyödyntää 2D-fysiikkamoottoria, tuhoutuvaa maastoa ja tila-ohjattua (State Machine) tekoälyvastustajaa.



---



\## 1. Arkkitehtuuri ja Pelisilmukka



Peli pyörii `gameLoop`-funktion ympärillä, joka kutsuu kahta pääfunktiota jokaisella ruudunpäivityksellä (requestAnimationFrame):



1\.  \*\*`update()`\*\*: Laskee pelilogiikan, fysiikan ja tekoälyn tilat. Se käyttää `deltaTime`-muuttujaa varmistaakseen, että liike on tasaista riippumatta ruudunpäivitysnopeudesta (FPS).

2\.  \*\*`draw()`\*\*: Tyhjentää kankaan ja piirtää pelitilanteen (maasto, tankit, ammukset, efektit) uudelleen.



\### Tilakone (Game State Machine)

Peliä ohjataan globaalilla `gameState`-muuttujalla:

\* \*\*`AIM`\*\*: Pelaaja tai Botti säätää putken kulmaa.

\* \*\*`POWER`\*\*: Välilyöntiä/W:tä painetaan (tai Botti lataa), ja voimapalkki kasvaa.

\* \*\*`RESOLVE`\*\*: Ammus on ilmassa. Vuoro ei voi vaihtua ennen kuin kaikki ammukset, räjähdykset ja partikkelit ovat kadonneet.

\* \*\*`GAME\_OVER`\*\*: Peli on päättynyt, odotetaan uudelleenkäynnistystä (R).



---



\## 2. Fysiikkamoottori ja Maasto



\### Fysiikka (`updateProjectiles`)

Ammukset noudattavat Eulerin integrointimenetelmää:

\* \*\*Painovoima:\*\* Vakio `GRAVITY` (150) lisää pystysuuntaista nopeutta (`vy`) joka sekunti.

\* \*\*Tuuli:\*\* Globaali `wind.x` vaikuttaa vaakasuuntaiseen nopeuteen (`vx`).

\* \*\*Nopeus:\*\* `vx` ja `vy` lisätään ammuksen koordinaatteihin (`x`, `y`) suhteessa aikaan (`dt`).



\### Maasto (`terrain` \& `Explosion`)

\* \*\*Generointi:\*\* Maasto on 1D-taulukko (`terrain\[]`), jossa indeksi on X-koordinaatti ja arvo on maaston korkeus (Y). Se luodaan summaamalla satunnaisia arvoja ja pehmentämällä ne (smoothing).

\* \*\*Tuhoutuminen:\*\* Kun `Explosion`-luokka laukeaa (`trigger`), se "kaivertaa" maastoa. Se laskee ympyrän muotoisen alueen ja asettaa `terrain\[x]` -arvon alemmaksi (suuremmaksi Y-arvoksi), jos räjähdys yltää maaston alle.



---



\## 3. 🤖 ShooterBot AI



Botin logiikka sijaitsee `ShooterBot`-luokassa. Se ei ole neuroverkko, vaan \*\*deterministinen, tila-pohjainen algoritmi\*\*, jossa on \*\*iteratiivinen takaisinkytkentäsilmukka (PID-säätimen kaltainen)\*\*.



\### Botin Pääfunktiot



\#### A. `prepareTurn()`

Kutsutaan heti, kun botin vuoro alkaa.

\* Asettaa tilaksi `WAITING`.

\* Kasvattaa `turnCounter`-laskuria (käytetään aseiden kierrätykseen).

\* Kutsuu `calculateShot()`-funktiota, joka on botin "aivot".



\#### B. `calculateShot()` – Botin päätöksentekolokiikka

Tämä on koodin monimutkaisin yksittäinen funktio. Se tekee kolme päätöstä:



1\.  \*\*Aseen Valinta (Weapon Selection):\*\*

&nbsp;   \* \*\*Easter Egg (1%):\*\* Valitsee `TELEPORTER`-aseen.

&nbsp;   \* \*\*Kriisitila (HP ≤ 1):\*\* 50% todennäköisyys `MIRV`:lle (epätoivoinen), 50% `HEAVY` tai `NAPALM`.

&nbsp;   \* \*\*Onnenlaukaus (20%):\*\* Valitsee satunnaisen erikoisaseen (`DIGGER`, `HEAVY`, jne.).

&nbsp;   \* \*\*Normaali sykli (Muu):\*\* Kiertää järjestelmällisesti `REGULAR` -> `CLUSTER` -> `BOUNCING`.



2\.  \*\*Kulman Valinta (Angle Selection \& Terrain Analysis):\*\*

&nbsp;   \* \*\*Syvä Kraatteri:\*\* Tarkistaa, onko botin Y-koordinaatti > 50px alempana kuin maasto ympärillä. Jos on, valitsee \*\*erittäin korkean kaaren (-0.55 rad)\*\* päästäkseen kuopasta ylös ilman, että ammus lentää liian kauas.

&nbsp;   \* \*\*Este (Line of Sight):\*\* `isLOSBlocked`-funktio tarkistaa, onko suora linja kohteeseen estetty maaston toimesta. Jos on, käytetään \*\*korkeaa kaarta (-0.65 rad)\*\*.

&nbsp;   \* \*\*Vapaa linja:\*\* Käyttää \*\*matalaa kaarta (-0.85 rad)\*\* tarkempaan ammuntaan.



3\.  \*\*Voiman Laskenta (Power Calculation \& Error Correction):\*\*

&nbsp;   \* \*\*Ensimmäinen laukaus:\*\* Arvaa voiman suoraan etäisyyden perusteella (`dist \* 0.55`).

&nbsp;   \* \*\*Korjauslaukaukset:\*\*

&nbsp;       \* Laskee virheen: `Error = TargetX - LastImpactX`.

&nbsp;       \* Laskee korjauksen: `Correction = Error \* K\_FACTOR`. (Korkeilla kulmilla K on 1.5x herkempi).

&nbsp;       \* \*\*Vaimennus (Damping):\*\* Jos virhe on valtava (> 150px), korjauskerroin puolitetaan. Tämä estää botin "räjähtämisen" laidasta laitaan.

&nbsp;       \* \*\*Rajoitin (Cap):\*\* Korjaus rajoitetaan maksimissaan ±150 yksikköön per vuoro.

&nbsp;       \* \*\*Tulos:\*\* `NewPower = LastPower + CappedCorrection`.

&nbsp;   \* \*\*Tuulikompensointi:\*\* Vähentää lopullisesta voimasta tuulen vaikutuksen (`wind.x \* 2.5`).



\#### C. `update(deltaTime)` – Botin "kädet"

Tämä funktio suorittaa `calculateShot`:n päättämät toimet ajastettuna:

1\.  \*\*WAITING (1.0s):\*\* Botti "miettii" paikallaan.

2\.  \*\*AIMING:\*\* Tykki kääntyy kohti laskettua kulmaa (`currentAngle`).

3\.  \*\*CHARGING:\*\* Kun kulma on valmis, peli siirtyy `POWER`-tilaan. Botti seuraa `chargePower`-muuttujaa.

4\.  \*\*FIRED:\*\* Kun `chargePower` vastaa laskettua `targetPower`ia, botti kutsuu `fireProjectile()`-funktiota.



\#### D. `updateLastImpact(x)` – Botin "silmät"

Tätä kutsutaan, kun ammus osuu maahan (`explodeProjectile`).

\* \*\*Suodatus:\*\* Botti kirjaa osuman muistiinsa \*\*vain\*\*, jos se on luotettava.

&nbsp;   \* Hyväksytyt: Regular, Heavy, Digger, Napalm, Sirpaleet (Fragments).

&nbsp;   \* Hylätyt: Cluster-emoammus, Bouncing (ellei hätätila).

\* \*\*Hätäkorjaus (Emergency Escape):\*\* Jos mikä tahansa ammus osuu alle 50px päähän botista (ts. osui kuopan reunaan), botti kirjaa "valheellisen" osuman kauas taakse. Tämä huijaa `calculateShot`-logiikkaa lisäämään rajusti voimaa seuraavalla vuorolla, jotta botti pääsee kuopasta pois.



---



\## 4. Asejärjestelmät (`ProjectileType` \& Logiikka)



Aseiden käyttäytyminen on hajautettu `fireProjectile`, `updateProjectiles` ja `explodeProjectile` funktioihin.



\* \*\*Auto-Split (MIRV \& Bot Cluster):\*\*

&nbsp;   \* `updateProjectiles` tarkistaa, onko ammus ollut ilmassa > 0.5s.

&nbsp;   \* Jos on, kutsutaan `splitProjectile`, joka poistaa emoammuksen ja luo `childCount` määrän uusia ammuksia pienellä nopeusvarianssilla.

&nbsp;   \* Botille (P2) tämä tapahtuu automaattisesti myös Clusterille, koska botti ei voi painaa nappeja. Pelaajalle (P1) Cluster vaatii napinpainalluksen.

\* \*\*Digger:\*\*

&nbsp;   \* Ei räjähdä osuessaan maahan (`terrain\[]`).

&nbsp;   \* Jatkaa matkaa maan sisällä (`penetration`-laskuri) kunnes syvyysraja täyttyy, jolloin se räjähtää.

\* \*\*Napalm:\*\*

&nbsp;   \* Luo `NapalmZone`-olion, joka jää kentälle elämään.

&nbsp;   \* `NapalmZone` aiheuttaa vahinkoa ajan funktiona (`damageTimer`) tankeille, jotka ovat sen säteellä.

\* \*\*Teleporter:\*\*

&nbsp;   \* Siirtää tankin X/Y-koordinaatit ammuksen osumakohtaan sen sijaan, että loisi räjähdyksen.



---



\## 5. Yhteenveto Botin "Persoonallisuudesta"



Nykyisillä asetuksilla botti käyttäytyy seuraavasti:

1\.  \*\*Alussa:\*\* Arvaa etäisyyden ja ampuu perusammuksia.

2\.  \*\*Osuessaan ohi:\*\* Korjaa voimaa järjestelmällisesti kohti pelaajaa.

3\.  \*\*Kuopassa:\*\* Tunnistaa tilanteen ja ampuu korkealla kaarella ulos.

4\.  \*\*Erikoistilanteet:\*\* Vaihtelee aseita tehdäkseen pelistä mielenkiintoisemman, ja muuttuu vaaralliseksi (MIRV) ollessaan häviöllä.

5\.  \*\*Vakaus:\*\* Ei enää "sekoa" suurista ohilaukauksista vaimennuslogiikan ansiosta.

