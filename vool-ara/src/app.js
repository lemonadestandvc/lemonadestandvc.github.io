(function(){
'use strict';

/* ===== Seaded: muuda enne avaldamist ===== */
const CONFIG = {
  shareUrl:'https://lemonadestand.ee/vool-ara/',
  feedbackEndpoint:'',         // valikuline: URL, mis võtab vastu JSON POST-i anonüümse tagasisidega
  appUrl:'https://www.olevalmis.ee/',
  guideUrl:'https://www.olevalmis.ee/kodused-varud',
  stockUrl:null,
  ctas:{share:true, again:true, app:true, stock:false}
};

const FAST = /[?&]fast=1/.test(location.search);
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const METERS = ['warmth','water','food','info','power','mood'];
const BASE = {warmth:70, water:30, food:35, info:20, power:45, mood:70};
const TOTAL_H = 62;
const BUDGET = 90, PREP_START = 16*60 + 40;         // 16:40, torm 18:12
const SHOP_BASE = 45, SHOP_PER_ITEM = 5, SHOP_QUEUE_MAX = 30;
const SCORE_LO = 10, SCORE_HI = 66;                  // kalibreeritud simulatsiooniga

const ML = {warmth:'Soojus', water:'Vesi', food:'Toit', info:'Info', power:'Aku', mood:'Meeleolu'};
const ICON = {
  warmth:'<path d="M12 3c1 3.5 5 5.2 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4.2.2 1.4.9 2.2 1.8 2.6C10.2 8.8 10.6 5.7 12 3z"/>',
  water:'<path d="M12 3.5C9 8 6.5 11 6.5 14.2a5.5 5.5 0 0 0 11 0C17.5 11 15 8 12 3.5z"/>',
  food:'<path d="M6 7c0-1.1 2.7-2 6-2s6 .9 6 2v10c0 1.1-2.7 2-6 2s-6-.9-6-2V7z"/><path d="M6 7c0 1.1 2.7 2 6 2s6-.9 6-2M6 12c0 1.1 2.7 2 6 2s6-.9 6-2"/>',
  info:'<path d="M6 17a8 8 0 0 1 0-10M9 14.5a4 4 0 0 1 0-5M18 7a8 8 0 0 1 0 10M15 9.5a4 4 0 0 1 0 5"/><circle cx="12" cy="12" r="1"/>',
  power:'<rect x="3" y="8" width="16" height="8" rx="2"/><path d="M21 11v2"/>',
  mood:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'
};

/* ===== Allikad ===== */
const SRC = {
  ov_el:{lab:'Ametlik juhis', name:'olevalmis.ee: Elektrikatkestus', url:'https://www.olevalmis.ee/elektrikatkestus'},
  ov_kute:{lab:'Ametlik juhis', name:'olevalmis.ee: Küttekatkestus', url:'https://www.olevalmis.ee/kuttekatkestus'},
  ov_vesi:{lab:'Ametlik juhis', name:'olevalmis.ee: Veekatkestus', url:'https://www.olevalmis.ee/veekatkestus'},
  ov_varud:{lab:'Ametlik juhis', name:'olevalmis.ee: Kodused varud', url:'https://www.olevalmis.ee/kodused-varud'},
  ov_nr:{lab:'Ametlik juhis', name:'olevalmis.ee: Abinumbrid', url:'https://www.olevalmis.ee/abinumbrid'},
  sim:{lab:'Ametlik juhis', name:'Siseministeerium: Käitumisjuhised kriisiolukordadeks', url:'https://siseministeerium.ee/sites/default/files/documents/2021-01/K%C3%A4itumisjuhised%20kriisiolukordadeks.pdf'},
  pa_kerk:{lab:'Ametlik juhis', name:'Päästeamet: Kerksuskeskus (infopunkt)', url:'https://www.rescue.ee/et/kerksuskeskus'},
  pa_vingu:{lab:'Päästeameti soovitus', name:'ERR: vingugaas ja liiga vara suletud siiber', url:'https://www.err.ee/897220/parnus-hukkus-vingugaasi-murgistuse-saanud-naine'},
  pa_kytt:{lab:'Päästeameti soovitus', name:'ERR: kütta kaks korda päevas, mitte üle kütta', url:'https://www.err.ee/902839/kova-pakane-eeldab-ettevaatlikkust-nii-kutmisel-kui-ka-oues-viibimisel'},
  gen:{lab:'Ohutusnõue', name:'ERR: generaatorid, priimused ja vingugaas', url:'https://www.err.ee/1608762442/inimesed-on-elektrikatkestuse-hirmus-soetanud-generaatorid-ja-priimused'},
  kute_el:{lab:'Taust', name:'ERR: elektrita seisavad majade küttepumbad', url:'https://www.err.ee/1608728929/elektrinappuse-korral-jaavad-esimesena-vooluta-elamud'},
  game:{lab:'Mänguvihje', name:'', url:''}
};

/* ===== Kuu järgi: ilm ja pimedus (Tallinn, ligikaudu) ===== */
const MONTHS = ['jaanuar','veebruar','märts','aprill','mai','juuni','juuli','august','september','oktoober','november','detsember'];
const DAYS = ['pühapäev','esmaspäev','teisipäev','kolmapäev','neljapäev','reede','laupäev'];
const MO = {
  0:{t:-3, dark:'kella nelja paiku', snow:true},
  1:{t:-4, dark:'kella viie paiku', snow:true},
  2:{t:-1, dark:'kella kuue paiku', snow:true},
  3:{t:5,  dark:'poole üheksa paiku', snow:false},
  9:{t:7,  dark:'kella kuue paiku', snow:false},
  10:{t:2, dark:'kella nelja paiku', snow:false},
  11:{t:-1,dark:'poole nelja paiku', snow:true}
};
function stormDates(now){
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if(!MO[d.getMonth()]) d = new Date(d.getMonth() > 9 ? d.getFullYear() + 1 : d.getFullYear(), 10, 10);
  while(d.getDay() !== 5) d.setDate(d.getDate() + 1);
  const out = [];
  for(let i = 0; i < 4; i++){ const x = new Date(d); x.setDate(d.getDate() + i); out.push(x); }
  return {list:out, mo:MO[out[0].getMonth()]};
}
const DATES = stormDates(new Date());
const dlabel = i => { const x = DATES.list[i]; return `${DAYS[x.getDay()]}, ${x.getDate()}. ${MONTHS[x.getMonth()]}`; };
const tempText = t => t > 0 ? `${t} kraadi sooja` : t < 0 ? `${-t} kraadi külma` : '0 kraadi';
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/* ===== Abi tekstidele ===== */
const p = (n, sg, pl) => n === 1 ? sg : pl;
const V = (x, c) => typeof x === 'function' ? x(c) : x;
const J = arr => arr.filter(Boolean).join(' ');

/* ===== Kodud ===== */
const HOMES = {
 paneel:{n:'Suur paneelmaja', s:'Kõrgel korrusel. Keskküte, lift ja veepump vajavad elektrit.', fireOk:false, pipes:3, temp:17, warmMul:.9, waterMul:1,
  out:'rõdul', outN:'Rõdu', ask:'Küsi naabritelt ja korteriühistult',
  intro:'Elate suure paneelmaja seitsmendal korrusel. Lift, maja veepump ja keskkütte pumbad töötavad elektriga.',
  dark:'Aknast paistab, et pime on kogu kvartal, tänavalaternad samuti.',
  tap:'Kraan teeb häält nagu vana auto, annab paar piiska ja vaikib. Maja veepump vajab elektrit.',
  pipesR:'Seitsmendal korrusel tuleb kraanist vaid paar klaasitäit. Alumised korrused on torud juba tühjaks lasknud.',
  neighT:'Mine trepikotta ja räägi naabritega',
  neighR:'Trepikojas põleb kolm taskulampi. Tiit viiendalt korruselt räägib generaatoritest, teised ei tea midagi. Aga see on soe „ei tea“, koos.',
  askR:'Korteriühistu paneb kokku ühise plaani: omavalitsuse veepaak peaks õhtuks tulema. Seniks laenab Tiit kaks kanistrit. Küsimine oli parim ressurss.',
  aino:'Üheksandal korrusel elab 82-aastane Aino. Lift ei tööta, raadiot tal pole ja ta on kaks ööd üksi olnud. Samal ajal hõikab Tiit viiendalt korruselt, et tal on generaator ja ta paneks selle trepikojas käima.',
  genIn:'trepikojas', point:'omavalitsus on avanud lähedal koolimajas infopunkti'},
 vaike:{n:'Väike kortermaja', s:'2-3 korrust ja mõni korter, näiteks renoveeritud puumaja. Elate esimesel korrusel.', fireOk:true, pipes:12, temp:15, warmMul:1.1, waterMul:1,
  out:'hoovis', outN:'Hoov', ask:'Küsi naabritelt ja korteriühistult',
  intro:'Elate väikese kortermaja esimesel korrusel. Teisel korrusel elab 82-aastane Aino.',
  heatEl:'Maja keskne gaasiküte vajab elektrit: katla automaatika ja pumbad töötavad vooluga.',
  dark:'Aknast paistab, et pime on kogu tänav, tänavalaternad samuti.',
  tap:'Veesurve on hommikust saati nõrgenenud ja nüüd tuleb kraanist vaid nire.',
  pipesR:'Esimesel korrusel on see eelis: kraanidest tuleb veel mitu ämbritäit torudesse jäänud vett. Kõik nõud, kastrulid ja pudelid saavad täis.',
  neighT:'Koputa naabrite uksele',
  neighR:'Kõik pered kogunevad trepikotta. Tiit kõrvalkorterist räägib generaatoritest, teised ei tea midagi. Aga see on soe „ei tea“, koos.',
  askR:'Korteriühistu paneb kokku ühise plaani: omavalitsuse veepaak peaks õhtuks tulema. Seniks laenab Tiit kaks kanistrit. Küsimine oli parim ressurss.',
  aino:'Teisel korrusel elab 82-aastane Aino. Raadiot tal pole ja ta on kaks ööd üksi olnud. Samal ajal hõikab Tiit kõrvalkorterist, et tal on generaator ja ta paneks selle teie ühises trepikojas käima.',
  genIn:'trepikojas', point:'omavalitsus on avanud lähedal koolimajas infopunkti'},
 eramaja:{n:'Eramaja linnas', s:'Oma küte, linna vesi ja kanalisatsioon.', fireOk:true, pipes:10, temp:14, warmMul:1.2, waterMul:1,
  out:'hoovis', outN:'Hoov', ask:'Küsi naabritelt ja jälgi linna teateid',
  intro:'Elate eramajas linna servas. Üle aia elab 82-aastane Aino.',
  heatEl:'Küte (gaasikatel, soojuspump või elekter) vajab tööks elektrit.',
  dark:'Aknast paistab, et pime on kogu tänav, tänavalaternad samuti.',
  tap:'Veesurve on hommikust saati nõrgenenud ja nüüd tuleb kraanist vaid nire.',
  pipesR:'Kraanidest tuleb veel mitu ämbritäit torudesse jäänud vett. Kõik nõud, kastrulid ja pudelid saavad täis.',
  neighT:'Mine üle aia naabritega rääkima',
  neighR:'Aia ääres seisavad neli taskulampi ja Tiit üle tee, kes räägib generaatoritest. Keegi ei tea midagi, aga see on soe „ei tea“, koos.',
  askR:'Naabrid on kuulnud, et omavalitsus toob õhtuks veepaagi kooli juurde. Tiit laenab seniks kaks kanistrit. Küsimine oli parim ressurss.',
  aino:'Üle aia elab 82-aastane Aino. Raadiot tal pole ja ta on kaks ööd üksi olnud. Samal ajal hõikab Tiit üle tee, et tal on generaator ja ta paneks selle garaažis käima.',
  genIn:'garaažis', point:'omavalitsus on avanud lähedal koolimajas infopunkti'},
 maa:{n:'Maamaja', s:'Puurkaev pumbaga, septik, naabrid kaugel.', fireOk:true, pipes:8, temp:13, warmMul:1.3, waterMul:1.3,
  out:'õues', outN:'Õu', ask:'Küsi naabritelt ja jälgi valla teateid',
  intro:'Elate maamajas. Vesi tuleb puurkaevust pumbaga, lähim naaber Aino elab kilomeetri kaugusel.',
  heatEl:'Küte (katel, soojuspump või elekter) vajab tööks elektrit.',
  dark:'Aknast paistab, et ka naabertalu tuled kustusid samal hetkel.',
  tap:'Puurkaevu pump vajab elektrit, nii et kraan jäi kuivaks juba eile õhtul.',
  pipesR:'Hüdrofooris ja torudes on veel natuke vett. Kõik nõud saavad täis ja iga tilk on arvel.',
  neighT:'Mine naabertallu',
  neighR:'Naabertalus on köetud ahi ja Tiit räägib generaatoritest. Keegi ei tea midagi, aga see on soe „ei tea“, koos.',
  askR:'Naabrid on kuulnud, et vald toob õhtuks veepaagi rahvamaja juurde. Tiit laenab seniks kaks kanistrit. Küsimine oli parim ressurss.',
  aino:'Kilomeetri kaugusel naabertalus elab 82-aastane Aino. Raadiot tal pole ja ta on kaks ööd üksi olnud. Samal ajal astub läbi naaber Tiit: tal on generaator ja ta paneks selle garaažis käima.',
  genIn:'garaažis', point:'vald on avanud rahvamajas infopunkti'}
};
const HEAT_TEXT = {ahi:'Toad köetakse ahjuga, kuivad puud on kuuris.', kamin:'Kodus on ka kamin, mis töötab ilma elektrita. Puud on olemas.'};
const FIRE = {ahi:{nom:'ahi', Nom:'Ahi'}, kamin:{nom:'kamin', Nom:'Kamin'}};

/* ===== Varud: kodused toimetused (kindlad, aga võtavad aega) ja poeskäik (ebakindel) ===== */
const ITEMS = [
 {id:'water', where:'home', min:10, fx:{water:25},
  n:'Lase vann ja kannud vett täis',
  d:c => `Teie peres ${c.people} × 3 l = ${c.people*3} liitrit joogivett päevas.`,
  tip:{src:'ov_vesi', text:'Hoia kodus võimalusel 3 liitrit vett inimese kohta ööpäevas ja mõtle läbi, kust saaks vett juurde.'}},
 {id:'power', where:'home', min:5, fx:{power:25},
  n:'Pane akupangad ja telefonid laadima',
  d:'Telefon on tänapäeval pere tuletorn.',
  tip:{src:'ov_el', text:'Hoia akupangad laetud: neid on vaja telefonide, lampide ja raadio jaoks.'}},
 {id:'light', where:'home', min:10, fx:{mood:8},
  n:'Otsi taskulambid välja',
  d:'Kus need olidki? Ja kas patareid töötavad?',
  tip:{src:'ov_el', text:'Hoia kodus taskulampi või muud valgusallikat ja varupatareisid. Elavat tuld ei tohi kunagi järelevalveta jätta.'}},
 {id:'warm', where:'home', min:15, fx:{warmth:10},
  n:'Too tekid, villased ja magamiskotid ühte tuppa',
  d:'Soe riie on kõige odavam kütteseade.',
  tip:{src:'ov_kute', text:'Riietu soojalt. Vali üks tuba, sulge uksed, aknad ja ventilatsiooniavad ning tihenda praod.'}},
 {id:'meds', where:'home', min:10, fx:{mood:10},
  n:'Vaata üle ravimid ja esmaabikarp',
  d:'Plaastrid, valuvaigisti ja pere püsiravimid.',
  tip:{src:'ov_varud', text:'Püsiravimeid vähemalt kuuks, käsimüügiravimeid vähemalt nädalaks ja esmaabivahendeid pereliikmete arvu järgi.'}},
 {id:'bags', where:'home', min:5, fx:{},
  n:'Otsi prügikotid ja teip välja',
  d:'Jah, WC jaoks. Jah, tõsiselt.',
  tip:{src:'ov_vesi', text:'Kui kanalisatsioon ei tööta, kasuta tualetis prügikotti ja lisa sinna imavat materjali, näiteks ajalehti või saepuru.'}},
 {id:'games', where:'home', min:5, fx:{mood:6},
  n:'Otsi lauamängud ja kaardipakk välja',
  d:'Kaardipakk kaalub 100 grammi ja päästab terve õhtu.',
  tip:{src:'game', text:'Ametlikus nimekirjas seda pole, aga kriis on lihtsam, kui on midagi teha, mis ei kuluta akut.'}},
 {id:'aino', where:'home', min:15, fx:{info:5},
  n:'Käi naabri Aino juures ja leppige kokku, kuidas teineteist aitate',
  d:'82-aastane, raadiot pole, telefon vana.',
  tip:{src:'sim', text:'Mõelge koos läbi, kuidas saate üksteist aidata, sealhulgas neid, kes vajavad kõrvalist abi, näiteks üksi elavaid eakaid.'}},
 {id:'food', where:'shop', p:.9, fx:{food:25},
  n:'Konservid ja kuivtoit',
  tip:{src:'ov_varud', text:'Varu nädala jagu toitu, mis säilib ega vaja külmkappi. Ära unusta lemmikloomi.'}},
 {id:'bottled', where:'shop', p:.6, fx:{water:15},
  n:'Pudelivesi',
  tip:{src:'ov_vesi', text:'Hoia kodus võimalusel 3 liitrit vett inimese kohta ööpäevas.'}},
 {id:'batt', where:'shop', p:.7, fx:{},
  n:'Patareid',
  tip:{src:'ov_el', text:'Hoia taskulampide ja raadio jaoks varupatareisid.'}},
 {id:'radio', where:'shop', p:.45, fx:{info:15},
  n:'Patareiraadio',
  tip:{src:'ov_varud', text:'Patarei- või dünamoraadio annab ametlikku infot ka siis, kui elekter ja side on maas.'}},
 {id:'stove', where:'shop', p:.55, fx:{food:5},
  n:'Matkapliit ja gaasiballoon',
  tip:{src:'ov_el', text:'Matkapliiti, priimust ja väligrilli kasuta ainult õues, sest põlemisel tekivad mürgised gaasid.'}},
 {id:'cash', where:'shop', p:.75, fx:{},
  n:'Sularaha automaadist',
  tip:{src:'ov_el', text:'Hoia sularaha umbes ühe nädala hädapäraste kulude jaoks, sest kaardi- ja telefonimaksed ning pangaautomaadid ei pruugi töötada.'}},
 {id:'baby', where:'shop', p:.85, fx:{mood:6}, show:c => c.f.baby > 0,
  n:'Beebi varud: piimasegu, mähkmed, salvrätikud',
  tip:{src:'game', text:'Kui beebi sööb piimasegu, hoia seda ja mähkmeid vähemalt nädala jagu. Pulbri segamiseks on vaja puhast vett, järgi pakendi juhist. Lapse tervise küsimustes aitab lastearsti nõuandeliin 1599.'}},
 {id:'co', where:'shop', p:.5, fx:{mood:4}, show:c => c.fire,
  n:'Vinguandur (patareiga)',
  tip:{src:'pa_vingu', text:'Päästeamet soovitab vingugaasiandurit igasse eluruumi, kus on ahi, kamin või pliit. Vingugaasi ei näe ega tunne.'}}
];
const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
const visibleItems = c => ITEMS.filter(i => !i.show || i.show(c));
const oddsText = pr => pr >= .85 ? ['tavaliselt olemas', ''] : pr >= .65 ? ['võib olla otsas', ''] : ['sageli otsas', 'lo'];

/* ===== Lugu ===== */
const PREP = {
 title:'Tormihoiatus',
 text:c => J([
  `Raadio hoiatab, et torm jõuab kohale poolteise tunni pärast ja vool võib ära minna. Õues on umbes ${tempText(DATES.mo.t)} ja pimedaks läheb juba ${DATES.mo.dark}.`,
  (c.f.school + c.f.teen) > 0 ? p(c.f.school + c.f.teen, 'Laps jõuab koolist koju veerand tunni pärast.', 'Lapsed jõuavad koolist koju veerand tunni pärast.') : '',
  'Paanikaks pole põhjust, aga kõike ei jõua. Mida teed?'
 ]),
 home:c => J([
  c.H.intro,
  c.fire ? HEAT_TEXT[c.heat] : c.H.heatEl,
  `Kodus on juba makaronid, kaks jõuluküünalt ja pooltühi akupank${c.f.dog ? ', koerale on pool kotti toitu' : ''}.`
 ])
};

const SC = [
 {id:'dark', sky:'night', hour:0, day:0, time:'18:12', drift:{},
  title:'Klõps',
  text:c => J([
   'Tuled kustuvad korraga.', c.H.dark,
   c.f.small ? p(c.f.small, 'Pisike teatab pimedusest: „Mina ei teinud seda!“', 'Pisikesed teatavad kooris: „Meie ei teinud seda!“') : '',
   c.f.school ? p(c.f.school, 'Koolilaps kuulutab, et võtab nüüd juhtimise üle.', 'Koolilapsed hakkavad kohe vaidlema, kes juhtimise üle võtab.') : '',
   c.f.teen ? p(c.f.teen, 'Teismeline vaatab telefoni ja ütleb tõsise häälega: „WiFi on läinud.“', 'Teismelised vaatavad telefone ja teatavad korraga: „WiFi on läinud.“') : '',
   c.f.baby ? p(c.f.baby, 'Beebi ärkab ja annab valjult teada, et talle see ei meeldi.', 'Beebid ärkavad ja annavad stereos teada, et neile see ei meeldi.') : '',
   !c.kids ? (c.f.adults > 1 ? 'Vaatate pimedas teineteist ja keegi ütleb: „Noh.“' : 'Oled kodus üksi ja pimedus on väga vaikne.') : '',
   c.f.dog ? 'Koer haugub korra pimeduse peale, et see teaks, kes siin peremees on.' : '',
   c.f.cat ? 'Kass ei tee väljagi.' : ''
  ]),
  mods:[
   {has:'light', fx:{mood:4}, text:'Taskulambid on käepärast, nii et keegi ei komista.'},
   {not:'light', fx:{mood:-6, power:-6}, text:'Töötavat taskulampi ei ole ja pimedas komistad kolm korda. Telefoni valgus tuleb appi, aga aku maksab selle eest.'}
  ],
  opts:[
   {id:'torch', req:'light', fx:{mood:14},
    t:'Võta taskulambid ja kogune ühte tuppa',
    r:c => c.kids ? 'Taskulambid jagatakse välja ja tuba muutub kosmoselaevaks. Sina oled kapten, ülejäänud nõuavad samuti auastmeid.' : 'Taskulamp lauale, tekk ümber, rahulik olek. Pimedus on korraga palju väiksem.',
    tip:{src:'ov_el', text:'Kasuta varutud valgusallikaid, et end pimedas mitte vigastada.'}},
   {id:'candles', fx:{mood:4},
    t:'Süüta jõuluküünlad',
    r:c => c.f.small ? 'Küünlavalgus on armas, kuni pisike otsustab, et need on sünnipäevaküünlad, ja puhub ühe ära. Teine vajub viltu ja püüad selle viimasel hetkel kinni. Edaspidi elavad küünlad kõrgel riiulil, valve all.' : 'Küünlavalgus on armas, kuni üks küünal vajub viltu ja püüad selle viimasel hetkel kinni. Edaspidi on küünlad ainult laual ja alati kellegi silma all.',
    tip:{src:'ov_el', text:'Elavat tuld ei tohi kunagi järelevalveta jätta ja põlemisel tekivad mürgised gaasid.'}},
   {id:'phone', fx:{power:-18, mood:2},
    t:'Valgusta tuba telefoniga',
    r:'Telefon teeb tööd hästi. Aku langeb nii kiiresti, et hakkad jooksvalt arvutama: 41%, 38%, 34%... Ja see on ka su ainus side välismaailmaga.',
    tip:{src:'ov_el', text:'Kasuta telefoni ja teisi akuga seadmeid säästlikult ning sulge palju voolu kulutavad rakendused.'}},
   {id:'fuse', fx:{info:12, power:-4},
    t:'Kontrolli kaitsmeid ja helista rikketelefonile',
    r:'Kaitsmed on korras, rike on väljaspool maja. Elektrilevi automaat teatab, et rike on suur ja lisainfo tuleb hiljem. Vähemalt tead, et probleem pole sinu kodus.',
    tip:{src:'ov_nr', text:'Kui võrguettevõte pole katkestusest teavitanud, anna rikkest märku. Elektrilevi rikketelefon on 1343.'}}
  ]},

 {id:'info', sky:'night', hour:3, day:0, time:'21:00', drift:{power:-8, mood:-5, food:-3},
  title:'Mida me teame?',
  text:c => J([
   c.kids ? (c.f.teen && c.kids === c.f.teen ? p(c.f.teen, 'Teismeline on oma toas ja säästab telefoni akut nagu pangahoiust.', 'Teismelised on oma toas ja säästavad telefoni akut nagu pangahoiust.') : 'Lapsed on lõpuks magama jäänud.') : 'Õhtu on vaikne.',
   'Telefoni leviriba käib ringi nagu eksinud turist. Tahaksid teada, mis juhtus ja kui kaua see kestab.'
  ]),
  mods:[{has:'power', fx:{mood:4}, text:'Akupank on laetud ja see rahustab rohkem, kui tahaksid tunnistada.'}],
  opts:[
   {id:'radio', req:'radio', fx:{info:30, mood:4},
    t:'Pane patareiraadio mängima',
    r:'Raadiost tuleb ametlik teade: tormirike on suur, elektrit taastatakse järk-järgult ja see võib võtta päevi. Ebameeldiv, aga vähemalt on see tõsi.',
    tip:{src:'ov_varud', text:'Patarei- või dünamoraadio annab ametlikku infot ka siis, kui elekter ja side on maas.'}},
   {id:'sms', fx:{power:-3, info:5, mood:10},
    t:'Saada lähedastele üks lühike sõnum ja pane telefon ära',
    r:'Üks rida: „Oleme OK, soe on, homme annan teada.“ Saadetud. Telefon läheb lennurežiimi. Mõnikord on üks lühike sõnum parem kui kümme kõnet.',
    tip:{src:'ov_el', text:'Kasuta telefoni ja teisi akuga seadmeid säästlikult ning sulge palju voolu kulutavad rakendused.'}},
   {id:'scroll', fx:{power:-20, info:4, mood:-12},
    t:'Keri perechatti ja sotsiaalmeediat',
    r:'Chatis on kaks uudist: et see kestab kuu aega ja et süüdi on tulnukad. Kumbki pole kinnitust leidnud. Aku langes 20 protsenti, tuju veel rohkem.',
    tip:{src:'ov_nr', text:'Kontrolli infot ametlikest allikatest: kriis.ee, olevalmis.ee või riigiinfo telefon 1247.'}},
   {id:'call', fx:{info:20, power:-8},
    t:'Helista riigiinfo telefonile 1247',
    r:'Järjekorras ootamine võtab aega, aga lõpuks vastab rahulik hääl. Ametlik pilt on selgem ja üllatavalt rahustav. Aku maksab selle eest natuke.',
    tip:{src:'ov_nr', text:'Riigiinfo telefon 1247 (välismaalt +372 600 1247) annab kriisi ajal ametlikku infot.'}},
   {id:'neigh', fx:{info:10, mood:6}, comm:1,
    t:c => c.H.neighT, r:c => c.H.neighR,
    tip:{src:'sim', text:'Mõelge koos läbi, kuidas saate üksteist aidata, sealhulgas neid, kes vajavad kõrvalist abi, näiteks üksi elavaid eakaid.'}}
  ]},

 {id:'cold', sky:'night', hour:13, day:1, time:'06:50', drift:{warmth:-28, water:-6, food:-5, power:-6, mood:-10, info:-8},
  title:c => c.fire ? 'Jahe hommik' : 'Radiaatorid',
  text:c => J([
   c.heat === 'ahi' ? 'Ahi on öö jooksul jahtunud. Toas on 17 kraadi, ahjukivid on veel leiged ja puud on olemas.'
   : c.heat === 'kamin' ? `Radiaatorid on külmad ja toas on ${c.H.temp} kraadi. Kamin ootab puudega.`
   : `Radiaatorid on külmad ja toas on ${c.H.temp} kraadi.`,
   c.f.small ? 'Pisike ärkab ja teatab, et toas on udu. See on tema hingeõhk.' : (c.f.school ? 'Koolilaps teatab, et ta näeb oma hingeõhku, ja tahab seda kõigile näidata.' : ''),
   c.f.dog ? 'Koer on end su jalgade peale kerinud nagu soojaveepudel.' : ''
  ]),
  opts:[
   {id:'fire_ok', show:c => c.fire, fx:c => ({warmth:c.heat === 'ahi' ? 30 : 24, mood:6}),
    mods:[{has:'co', fx:{mood:3}, text:'Vinguandur vilgutab seinal rahulikult rohelist tuld.'}],
    t:c => `Küta ${FIRE[c.heat].nom} õigesti: siiber lahti, kuivad puud, kolle mitte liiga täis`,
    r:c => `Siiber täiesti lahti, kuivad halud, kolle mitte liiga täis. Pool tundi hiljem ${c.heat === 'ahi' ? 'ahi mühiseb' : 'kamin praksub'} ja kõik istuvad selle ees nagu lõkke ääres. Siibri paned kinni alles siis, kui leeki enam pole ja järel on vaid hõõguvad söed.`,
    tip:{src:'pa_vingu', text:'Siiber olgu kütmise ajal täiesti lahti. Liiga vara suletud siiber on vingugaasimürgistuse sage põhjus. Küta ahju või kaminat vaid siis, kui oled ärkvel.'}},
   {id:'fire_damper', show:c => c.fire, fx:{warmth:18, mood:-6},
    mods:[
     {has:'co', fx:{mood:-4}, text:'Vinguandur hakkab piiksuma. Teed siibri ja aknad lahti ja viid pere hetkeks värske õhu kätte. Andur tegi täpselt seda, milleks ta seinal on.'},
     {not:'co', fx:{mood:-18, warmth:-6}, text:'Mõne aja pärast hakkab pea valutama ja keegi on imelikult unine. Taipad, mis toimub: siiber lahti, aknad lahti, kõik õue värske õhu kätte. Kui kellelgi on halb, helista 112.'}
    ],
    t:'Sulge siiber varakult, et soojus korstnast välja ei läheks',
    r:'Leek on juba väike ja tundub, et soojus pääseb korstnast välja. Lükkad siibri kinni.',
    tip:{src:'pa_vingu', text:'Sulge siiber alles siis, kui leeki pole ja järel on vaid hõõguvad söed. Päästeamet soovitab vingugaasiandurit igasse koju, kus on ahi, kamin või pliit.'}},
   {id:'fire_over', show:c => c.fire, fx:{warmth:22, mood:-8},
    t:c => `Lao ${FIRE[c.heat].nom} puid täis ja küta terve päev järjest`,
    r:c => `${FIRE[c.heat].Nom} läheb nii kuumaks, et seda ei saa puudutada, ja korstnast kostab mühinat. Toas on palav, aga sul hakkab kõhe. Lased ${c.heat === 'ahi' ? 'ahjul' : 'kaminal'} rahulikult maha jahtuda.`,
    tip:{src:'pa_kytt', text:'Päästeamet soovitab külmaga kütta kaks korda päevas, hommikul ja õhtul, mitte laduda korraga palju puid. Ülekütmine on tulekahjude sage põhjus.'}},
   {id:'one_room', fx:{warmth:22, mood:4},
    mods:[
     {has:'warm', fx:{warmth:10}, text:c => c.f.school ? 'Magamiskotid ja villased! Koolilaps kuulutab toa Tekilinnuseks ja nõuab uksel parooli.' : 'Magamiskotid ja villased! Tuba muutub Tekilinnuseks.'},
     {has:'bags', fx:{warmth:8}, text:'Teip akna servadel hoiab tuuletõmbuse väljas.'},
     {has:'games', fx:{mood:6}, text:'Tekilinnuses on ka kaardipakk. Külm ununeb kolmeks käiguks.'}
    ],
    t:'Kogunege ühte tuppa, sulge uksed ja tihenda praod',
    r:'Kõik kolivad ühte tuppa: tekid, padjad, ka koer, kui on. Uksed kinni, ventilatsiooniavad kinni, rätikud ukse alla, paks tekk akna ette. Kraadiklaas tõuseb vaid paar kraadi, aga tunne on palju soojem.',
    tip:{src:'ov_kute', text:'Vali üks tuba, mida soojas hoida. Sulge uksed, aknad ja ventilatsiooniavad, tihenda praod ja kata suured aknad paksu kanga või tekiga.'}},
   {id:'stove_in', show:c => !c.fire, req:'stove', fx:{warmth:6, mood:-18},
    t:'Too matkapliit tuppa ja keeda köögis vett',
    r:'Köök läheb hetkeks soojaks, aga õhk muutub raskeks ja kellelgi hakkab pea valutama. Viid pliidi kohe õue, teed aknad lahti ja kõik lähevad hetkeks värske õhu kätte.',
    tip:{src:'ov_el', text:'Matkapliiti, priimust ja väligrilli kasuta ainult õues, sest põlemisel tekivad mürgised gaasid.'}},
   {id:'stove_out', show:c => !c.fire, req:'stove', fx:{warmth:14, food:6, mood:12},
    t:c => `Keeda ${c.H.out} kuuma vett`,
    r:c => `${c.H.outN}, matkapliit, välisõhk. Tass kuuma vett ja viimane kakaopakk: kõigil on käes midagi sooja. Pliit jääb õue ja sa ei lahku selle juurest.`,
    tip:{src:'ov_el', text:'Matkapliiti, priimust ja väligrilli kasuta ainult õues. Elavat tuld ei tohi jätta järelevalveta.'}},
   {id:'bed', fx:{warmth:-14, mood:-4},
    t:'Jää voodisse ja oota, et küte taastuks',
    r:'Voodis on mõnus, kuni jalad külmuvad. Pool tundi hiljem oled ikkagi püsti ja otsid sokke.',
    tip:{src:'kute_el', text:'Kui majas pole elektrit, ei tööta ka küttesüsteemi pumbad ja automaatika. Küte ei taastu enne voolu.'}}
  ]},

 {id:'water', sky:'day', hour:17, day:1, time:'11:30', drift:{water:-15, food:-5, power:-4, warmth:-4, mood:-8},
  title:'Kraan köhatab',
  text:c => J([
   c.H.tap,
   c.f.small && c.f.school ? 'Pisike küsib: „Kus vesi on?“ Koolilaps vastab: „Mõtle, kus on jõgi.“' : (c.f.small ? 'Pisike küsib väga tõsiselt: „Kas vesi läks ka magama?“' : '')
  ]),
  mods:[
   {has:'bags', fx:{mood:10}, text:'WC-küsimus laheneb prügikoti ja vana ajalehega. Keegi nimetab seda kuninglikuks trooniks.'},
   {not:'bags', fx:{mood:-12, water:-6}, text:'WC-küsimus on keerulisem. Ütleme vaid, et ämbrid ja naabrite kannatlikkus said proovile.'}
  ],
  opts:[
   {id:'plan', fx:{water:8, mood:3},
    mods:[{has:'water', fx:{water:15}, text:'Vannitäis ja kannud! Vann saab nimeks Järv. Loputusvesi tuleb Järvest, joogivesi kannudest.'}],
    t:'Tee veeplaan: 3 liitrit inimese kohta päevas',
    r:c => `Kirjutate paberile: ${c.people} ${p(c.people, 'inimene', 'inimest')} × 3 liitrit = ${c.people*3} liitrit joogivett päevas. Ülejäänud vesi läheb pesemiseks ja loputuseks. Paberile, et keegi ei unustaks.`,
    tip:{src:'ov_vesi', text:'Hoia kodus võimalusel 3 liitrit vett inimese kohta ööpäevas.'}},
   {id:'pipes', fx:c => ({water:c.H.pipes, mood:2}),
    t:'Lase torudesse jäänud vesi anumatesse',
    r:c => c.H.pipesR,
    tip:{src:'ov_vesi', text:'Torudesse jäänud vee saab kraanidest anumatesse lasta.'}},
   {id:'snow', show:() => DATES.mo.snow, req:'stove', fx:{water:28, warmth:-3, mood:3},
    t:c => `Sulata ja keeda lund ${c.H.out}`,
    r:'Lumi potti, pott matkapliidile ja keeta suurel kuumusel 10 minutit. Aeglane, aga töötab. Maitseb natuke nagu talv.',
    tip:{src:'ov_el', text:'Looduslikust veekogust võetud vett, sealhulgas lumevett, keeda suurel kuumusel 10 minutit või kasuta filtrit või veepuhastustablette.'}},
   {id:'teen', show:c => c.f.teen > 0, fx:{water:14, mood:6},
    mods:[{has:'stove', fx:{water:8}, text:'Allikavee keedad enne joomist matkapliidil läbi.'},
          {not:'stove', fx:{mood:-3}, text:'Keeta pole millegi peal, nii et allikavesi läheb pesemiseks ja loputuseks.'}],
    t:'Saada teismeline kanistritega lähimale allikale',
    r:'Teismeline nuriseb viis minutit, siis läheb. Tagasi tuleb ta kahe täis kanistriga ja haruldase naeratusega, sest allika juures oli levi.',
    tip:{src:'ov_vesi', text:'Lähimad joogiveeallikad leiad aadressilt allikad.info. Looduslikku vett tuleb enne joomist keeta.'}},
   {id:'spring', fx:{water:16, warmth:-8, mood:2},
    mods:[
     {has:'stove', fx:{water:12}, text:'Kodus keedad vee matkapliidil läbi. Nii ongi õige.'},
     {not:'stove', fx:{mood:-4}, text:'Keeta pole millegi peal, nii et allikavesi läheb pesemiseks ja loputuseks, mitte joomiseks.'}
    ],
    t:'Mine kanistritega lähimale allikale',
    r:c => J(['Allikas on kahekümne minuti kaugusel. Tagasi tulles on kanistrid kaks korda raskemad ja põsed punased.',
      c.kids ? (c.f.adults > 1 ? 'Lapsed jäid teise täiskasvanu hoole alla.' : 'Lapsed jäid naabrite juurde ja on seal väga õnnelikud.') : '']),
    tip:{src:'ov_vesi', text:'Lähimad joogiveeallikad leiad aadressilt allikad.info. Looduslikku vett tuleb enne joomist keeta.'}},
   {id:'ask', fx:{info:10, water:8}, comm:1,
    t:c => c.H.ask, r:c => c.H.askR,
    tip:{src:'ov_vesi', text:'Jälgi kohaliku omavalitsuse teadaandeid elanike joogiveega varustamise kohta.'}}
  ]},

 {id:'food', sky:'day', hour:20, day:1, time:'14:00', drift:{food:-12, warmth:-4, power:-4, info:-6, mood:-8},
  title:'Söögiaeg',
  text:c => J([
   'Külmkapp on veel jahe, kui seda ei ava.',
   c.f.school ? 'Koolilaps on selle ukse juures juba kolm korda „kontrollimas“ käinud.' : (c.f.teen ? 'Teismeline on selle ukse juures juba kolm korda „kontrollimas“ käinud.' : ''),
   'Kõik on näljased ja keegi ei taha pimedas elada ainult kreekeritest.'
  ]),
  mods:[
   {has:'baby', show:c => c.f.baby > 0, fx:{mood:6}, text:'Beebi varud on olemas: piimasegu, mähkmed ja salvrätikud. Beebi ei saa arugi, et midagi juhtus.'},
   {not:'baby', show:c => c.f.baby > 0, fx:{mood:-16}, text:'Mähkmed hakkavad otsa saama ja piimasegu on viimane karp. Naabrinaine jagab oma varudest, aga närvid on pingul.'},
   {not:'food', show:c => c.pets, fx:{mood:-3}, text:c => `Lemmikloomatoit on otsakorral ja ${c.f.dog ? 'koer' : 'kass'} vaatab sind etteheitvalt.`}
  ],
  opts:[
   {id:'fridge', fx:{food:14, mood:3},
    t:'Söö kõigepealt kiiresti riknev ja ava külmkappi harva',
    r:c => `Kõigepealt kiiresti riknevad asjad. Külmkapi uks avaneb vaid korra: vajalik välja ja kinni. ${c.f.school ? 'Koolilaps' : c.f.teen ? 'Teismeline' : 'Keegi'} määratakse ametlikuks külmkapivahiks ja võtab rolli väga tõsiselt.`,
    tip:{src:'ov_el', text:'Ava külmkappi ja sügavkülmikut võimalikult harva, siis püsib toit kauem jahe.'}},
   {id:'cook', req:'stove', fx:{food:30, warmth:6, mood:14},
    t:c => `Keeda ${c.H.out} makarone`,
    r:'Makaronid ja viimane sprotipurk matkapliidil: pidu! Pliit on õues, uks kinni, õhk külm ja inimesed rõõmsad. Hetkeks tundub, et pimedus on lihtsalt matk.',
    tip:{src:'ov_el', text:'Matkapliiti, priimust ja väligrilli kasuta ainult õues. Elavat tuld ei tohi jätta järelevalveta.'}},
   {id:'shop', fx:{food:3, mood:-8},
    mods:[
     {has:'cash', fx:{food:36, mood:20}, text:'Kaardimaksed ei tööta, aga kassapidaja loeb sularaha ja pimedas poes on veel leiba, konserve ja šokolaadi.'},
     {not:'cash', fx:{mood:-4}, text:'Kaardilugeja on pime ja pangaautomaat samuti. Kassapidaja kirjutab su nime vihikusse ja palub homme tagasi tulla. Lähed koju peaaegu tühjade kätega.'}
    ],
    t:'Mine lähimasse poodi',
    r:'Pood on lahti, aga pime. Kassapidaja töötab taskulambi ja kalkulaatoriga.',
    tip:{src:'ov_el', text:'Hoia sularaha umbes ühe nädala hädapäraste kulude jaoks, sest kaardi- ja telefonimaksed ei pruugi töötada.'}},
   {id:'cold', fx:{food:6, mood:-3},
    mods:[{has:'food', fx:{food:10}, text:c => `Konservid, kreekerid ja pähklid: kapp on nagu väike pood.${c.pets ? ' Lemmikloomale on samuti varutud.' : ''}`}],
    t:'Söö külmalt: konservid ja kuivtoit',
    r:'Külm kuivtoit ja kreekerid. Kõht saab täis, aga tuju see ei tõsta.',
    tip:{src:'ov_varud', text:'Vali varuks toite, mida on lihtne valmistada, mis säilivad kaua ega vaja külmkappi.'}}
  ]},

 {id:'evening', sky:'night', hour:24, day:1, time:'18:00', drift:{mood:-14, warmth:-6, food:-5, power:-6, water:-6},
  title:'Pikk õhtu',
  text:c => J([
   'Pimedat on olnud nüüd ööpäev.',
   c.f.school ? p(c.f.school, 'Koolilaps on asutanud Pimeduse Kohtu ja nimetanud end kohtunikuks.', 'Koolilapsed on asutanud Pimeduse Kohtu ja vaidlevad, kes on kohtunik.') : '',
   c.f.small ? 'Pisike on süüdistatav, süüdistus on „liiga vali nohin“.' : '',
   c.f.teen ? 'Teismeline kirjutab paberile päevikut, „et järeltulevad põlved teaksid“.' : '',
   c.f.baby ? 'Beebi magab, nagu poleks midagi juhtunud. Ainus pereliige, kellel on kõik kontrolli all.' : '',
   'Õhtu on pikk ja akusid on vähe.'
  ]),
  mods:[
   {has:'meds', fx:{mood:8}, text:c => `${c.f.small ? 'Pisike komistab' : c.f.school ? 'Koolilaps komistab' : 'Komistad ise'} pimedas ja põlvele tuleb muhk. Esmaabikarbis on plaaster ja asi on korras.`},
   {not:'meds', fx:{mood:-14}, text:c => `${c.f.small ? 'Pisike komistab' : c.f.school ? 'Koolilaps komistab' : 'Komistad ise'} pimedas ja põlvele tuleb muhk. Plaastrit pimedas ei leia, nii et kallistus peab piisama.`}
  ],
  opts:[
   {id:'games', req:'games', fx:{mood:34},
    t:'Lauamängud taskulambi valgel',
    r:c => c.f.school ? 'Taskulambi valgel mängite kaarte. Koolilaps võidab. Koolilaps võidab alati. Aga naer on päeva jooksul esimest korda vali ja päris.' : 'Taskulambi valgel mängite kaarte ja naer on päeva jooksul esimest korda vali ja päris.',
    tip:{src:'game', text:'Mäng ei kuluta akut ja hoiab tuju üleval.'}},
   {id:'shadow', req:'light', fx:{mood:20},
    t:'Varjuteater taskulambiga',
    r:c => c.kids ? 'Seinale sünnivad hiiglane, lohe ja Tiit (laste versioon). Taskulamp, käed ja natuke julgust: rohkem pole vaja.' : 'Seinale sünnivad lohe ja Tiit. Üllatavalt naljakas.',
    tip:{src:'game', text:'Tasuta meelelahutus, mis ei vaja akut ega internetti.'}},
   {id:'stories', fx:{mood:12, warmth:4},
    t:'Rääkige lugusid tekkide all',
    r:c => c.kids ? 'Räägid loo sellest, kuidas vanaema elas ilma elektrita. Keegi lisab sinna lohe. Pooled jäävad poole loo pealt magama. Kõigil on soe.' : 'Räägite, kuidas vanavanemad ilma elektrita elasid. Lugu läheb pikaks ja kõigil on soe.',
    tip:{src:'game', text:'Lugu ei maksa midagi peale hääle.'}},
   {id:'screen', fx:{mood:14, power:-28},
    mods:[{has:'power', fx:{power:12}, text:'Akupank on iga grammi väärt: telefon saab uue ringi.'}],
    t:c => c.kids ? 'Anna lastele telefon: multikad' : 'Vaata telefonist allalaaditud sarja',
    r:c => c.kids ? 'Kümme minutit täielikku rahu. Siis on aku 11% ja lapsed tahavad veel. Selline tehing.' : 'Kaks osa sarja ja aku on 11%. Selline tehing.',
    tip:{src:'ov_el', text:'Kasuta telefoni ja teisi akuga seadmeid säästlikult.'}}
  ]},

 {id:'aino', sky:'day', hour:40, day:2, time:'10:00', drift:{warmth:-10, food:-6, water:-6, power:-6, mood:-12, info:-8},
  title:'Naaber Aino',
  text:c => c.H.aino,
  mods:[{has:'aino', fx:{mood:6, info:4}, text:'Te leppisite reedel kokku, et käid tal iga päev korra läbi. Aino ootab sind juba ukse peal.'}],
  opts:[
   {id:'invite', fx:{warmth:-4, food:-4, mood:10, info:8}, comm:1,
    mods:[{has:'radio', fx:{info:6, mood:4}, text:'Kuulate Ainoga koos patareiraadiot. Ta tunneb kõiki vanu saatejuhte ja kommenteerib iga uudist.'}],
    t:'Kutsu Aino enda juurde',
    r:c => `Aino tuleb, toob termose ja pasteedipurgi ning teatab, et tal on tormidega kogemust.${c.kids ? ' Lapsed jagavad temaga tekki ja kuulutavad ta ametlikult vanaemaks.' : ''}`,
    tip:{src:'sim', text:'Mõelge läbi, kuidas saate üksteist aidata, sealhulgas neid, kes vajavad kõrvalist abi, näiteks üksi elavaid eakaid.'}},
   {id:'gen_out', fx:{power:25, info:8, mood:8}, comm:2,
    t:'Ütle Tiidule: generaator ainult õue. Tehke laadimispunkt',
    r:'Generaator läheb õue, eemale akendest ja ustest. Pikendusjuhe tuuakse sisse ja sinna tekib laadimispunkt. Tiit on kangelane ja räägib sellest veel aastaid. Viid Ainole akupanga ja kuuma vett.',
    tip:{src:'gen', text:'Generaatori heitgaasis on vingugaas. Generaator kuulub õue, mitte trepikotta, garaaži ega elamisse.'}},
   {id:'gen_in', fx:{power:10, mood:-22},
    t:c => `Lase Tiidul generaator ${c.H.genIn} käima panna`,
    r:c => `Tiit paneb generaatori ${c.H.genIn} käima. Viie minuti pärast on kõik uksed ja aknad lahti, Tiidul on peavalu ja keegi õpib õppetunni, mille oleks saanud ka raamatust. Generaator läheb õue.`,
    tip:{src:'gen', text:'Generaatori heitgaasis on vingugaas, mida ei näe ega tunne. Generaator kuulub õue, mitte siseruumidesse.'}},
   {id:'alone', fx:{mood:-2},
    t:'Hoia oma pesa ja saa ise hakkama',
    r:'Hoiad oma pesa soojana ja pere rahulikuna. Terve päeva mõtled siiski Ainole. Pärastlõunal viid talle ikkagi kuuma vett.',
    tip:{src:'game', text:'Kriisis on naabrid ressurss: kahel käepaaril on rohkem jõudu kui ühel.'}}
  ]},

 {id:'point', sky:'dusk', hour:45, day:2, time:'15:30', drift:{warmth:-8, food:-5, power:-5, water:-5, mood:-12},
  title:'Infopunkt',
  text:c => J([
   `Raadiost (või naabrilt, kui raadiot pole) kuuled, et ${c.H.point}: sealt saab infot, nõu ja abi, seal on soe ja saab telefoni laadida.`,
   c.f.baby || c.f.small ? 'Väikeste lastega on otsus raskem: tee sinna on pikk, aga kodu jahtub.' : '',
   'Kas jääte koju või lähete?'
  ]),
  opts:[
   {id:'go', fx:{warmth:30, info:25, food:10, mood:8, power:10},
    t:c => c.f.dog ? 'Mine perega infopunkti (koer tuleb ka)' : 'Mine perega infopunkti',
    r:c => `Soe ruum, kuum tee, laadimispunkt ja kümmekond sama väsinud nägu.${c.f.school ? ' Koolilaps selgitab vabatahtlikule Pimeduse Kohtu reegleid.' : ''} Sinna minna ei ole häbi: just selleks need kohad ongi.`,
    tip:{src:'ov_kute', text:'Kui sa ei saa ilma kütteta turvaliselt hakkama, mine lähedaste juurde või lähimasse infopunkti (ametlik nimi on kerksuskeskus). Uuri juba praegu, kus see sinu kodukandis asub.'}},
   {id:'stay', fx:{mood:2},
    mods:[
     {test:st => st.m.warmth < 45, fx:{warmth:-8, mood:-12}, text:'Toas on nüüd üheksa kraadi ja tunned, et pere piir on käes. Ühes toas peate vastu, aga külm hakkab näpistama.'},
     {has:'warm', fx:{warmth:10}, text:'Magamiskotid hoiavad pere soojana ka siis, kui tuba on külm.'},
     {has:'games', fx:{mood:8}, text:'Kaardipakk tuleb välja ja õhtu läheb kiiresti.'},
     {test:st => st.m.warmth >= 45, fx:{mood:8}, text:'Pere on ühes toas, soe ja üsna rahulik. Kodu on ikka kodu.'}
    ],
    t:'Jää koju ja jätka sama plaaniga',
    r:'Otsustad koju jääda. Lõpuks sõltub see sellest, kui soe kodu veel on.',
    tip:{src:'ov_kute', text:'Koju jääda on mõistlik seni, kuni seal on turvaline ja piisavalt soe. Kui ei ole, mine lähedaste juurde või infopunkti (kerksuskeskusse).'}},
   {id:'go_all', fx:{warmth:30, info:25, food:10, mood:12, power:10}, comm:1,
    t:'Võta Aino ja Tiit infopunkti kaasa',
    r:c => `Kolm põlvkonda${c.pets ? ' ja üks loom' : ''} lähevad infopunkti. Aino istub kõige soojemale kohale, Tiit selgitab kõigile generaatori tööpõhimõtet${c.kids ? ' ja lapsed jagavad kõigile kaarte' : ''}. Parim seltskond, mida pimedas leida.`,
    tip:{src:'pa_kerk', text:'Infopunkt (ametlikult kerksuskeskus) on omavalitsuse avatud koht, kust saab kriisi ajal infot, nõu ja abi. Võta kaasa ka need, kes ise ei jõua.'}}
  ]}
];

/* ===== Hilinenud tagajärjed: varasem otsus annab hiljem tunda ===== */
const did = (st, id) => st.log.includes(id);
const ECHO = {
 cold:[
  {test:st => did(st, 'scroll') && !st.picks.includes('radio'), fx:{mood:-8}, text:'Reede õhtul loetud perechatt annab tunda: öösel levis uus kuulujutt, et kraanivesi on mürgitatud. Pool hommikust kulub rahustamisele.'},
  {test:st => did(st, 'scroll') && st.picks.includes('radio'), fx:{info:4}, text:'Perechatis levib kuulujutt, et kraanivesi on mürgitatud. Raadio hommikuuudised lükkavad selle ümber.'},
  {test:st => did(st, 'sms'), fx:{mood:6, info:4}, text:'Eilsele lühikesele sõnumile tuli öösel vastus: lähedased teavad, et teil on kõik hästi, ja keegi ei sõida pimedas teid otsima.'},
  {test:st => did(st, 'phone'), fx:{power:-6}, text:'Eilne telefoniga valgustamine on aku juba poolenisti tühjaks võtnud.'}
 ],
 evening:[
  {test:st => did(st, 'candles') && !st.picks.includes('light'), fx:{mood:-8}, text:'Jõuluküünlad põlesid eile õhtul lõpuni. Täna pole enam millegagi valgust teha.'},
  {test:st => did(st, 'fire_over'), fx:{warmth:-8}, text:c => `Pärast hommikust ülekütmist on ${c.heat === 'ahi' ? 'ahju' : 'kamina'} küljel peenike pragu. Kütad nüüd väiksema koormaga ja tuba jääb jahedamaks.`},
  {test:st => did(st, 'bed'), fx:{mood:-4}, text:'Hommikune voodis ootamine maksab õhtul kätte: kõigil on külm ja tuju on nõrk.'},
  {test:st => did(st, 'one_room'), fx:{warmth:4}, text:'Hommikul tihendatud tuba hoiab sooja ka õhtul.'}
 ],
 aino:[
  {test:st => !did(st, 'fridge'), fx:{food:-8}, text:'Külmkapis olnud hakkliha lõhnab kahtlaselt ja läheb prügisse. Uks käis eile liiga tihti lahti.'},
  {test:st => did(st, 'fridge') && st.m.food >= 25, fx:{food:6}, text:'Kinnine külmkapiuks tasus ära: hommikusöök on veel piimaga.'},
  {test:st => did(st, 'plan') && st.m.water >= 25, fx:{water:8}, text:'Laupäevane veeplaan peab: joogivett on veel ja keegi pole janus.'},
  {test:st => did(st, 'screen') && !st.picks.includes('power'), fx:{power:-8}, text:'Eilne multikaõhtu on telefoni peaaegu tühjaks võtnud.'},
  {test:st => did(st, 'shop') && !st.picks.includes('cash'), fx:{mood:2}, text:'Poemüüja vihikus on eilsest sinu nimi. Lubad maksma tulla kohe, kui automaadid töötavad.'},
  {test:st => did(st, 'neigh') || did(st, 'ask'), fx:{info:4, mood:4}, text:'Naabrid teavad nüüd üksteist nimepidi. Hommikul koputab keegi ja küsib, kas teil on kõik olemas.'}
 ],
 point:[
  {test:st => did(st, 'call'), fx:{info:6}, text:'Riigiinfo telefonil öeldi reedel, et omavalitsus avab vajadusel infopunkti. Sa kirjutasid info üles ja tead nüüd, kuhu minna.'},
  {test:st => did(st, 'invite'), fx:{mood:6, food:4}, text:'Aino on hommikust saati teie juures. Ta on termosed täitnud ja võileivad teinud, „igaks juhuks“.'},
  {test:st => did(st, 'gen_out'), fx:{power:10}, text:'Tiidu laadimispunktist said kõik telefonid täis.'},
  {test:st => did(st, 'gen_in'), fx:{mood:-4}, text:'Pärast hommikust generaatoriintsidenti on Tiit veel kahvatu ja aknad on tuulutuseks lahti.'}
 ]
};
const CRISES = [
 {k:'food', lim:15, fx:c => ({mood:-(8 + 4 * Math.min(c.kids, 3)), warmth:-4}),
  text:c => c.kids >= 2 ? `Toit on otsas. ${c.kids} näljast last pimedas on kõige raskem asi, mida ette kujutada: nutt, tülid ja „mul on kõht tühi“ iga viie minuti tagant. Tühja kõhuga on ka külmem.`
   : c.kids === 1 ? 'Toit on otsas. Näljane laps pimedas on kõige raskem asi, mida ette kujutada. Tühja kõhuga on ka külmem.'
   : 'Toit on otsas. Tühja kõhuga on külmem, tuju kehvem ja iga otsus raskem.'},
 {k:'water', lim:15, fx:{mood:-10},
  text:'Joogivesi on peaaegu otsas. Jagate viimaseid lonkse ja janu teeb kõik pahuraks.'},
 {k:'warmth', lim:20, fx:{mood:-10},
  text:c => c.f.baby || c.f.small ? 'Toas on nii külm, et isegi tekkide all värisetakse. Väikestele lastele on see juba ohtlik: on aeg mõelda sooja koha peale.' : 'Toas on nii külm, et isegi tekkide all värisetakse. On aeg mõelda sooja koha peale.'},
 {k:'power', lim:5, fx:{info:-6, mood:-4},
  text:'Kõik telefonid on tühjad. Te ei saa kellelegi helistada ega uudiseid lugeda.'}
];
function sceneEntry(st, i){
  const sc = SC[i], c = ctx(st), d = sceneDrift(sc, st), echo = [], crisis = [];
  if(i > 0){
    const after = Object.assign({}, st.m); for(const k in d) after[k] = clamp(after[k] + Math.round(d[k]));
    CRISES.forEach(cr => {
      if(after[cr.k] >= cr.lim) return;
      crisis.push(V(cr.text, c));
      const fx = V(cr.fx, c); for(const k in fx) d[k] = (d[k] || 0) + fx[k];
    });
  }
  (ECHO[sc.id] || []).forEach(e => {
    if(!e.test(st)) return;
    echo.push(V(e.text, c));
    for(const k in e.fx) d[k] = (d[k] || 0) + e.fx[k];
  });
  return {d, echo, crisis};
}

const END = {
 text:c => J([
  'Külmkapp hakkab urisema, keegi hüüab: „Tuli tuli tagasi!“ Kuuskümmend kaks tundi pärast klõpsu on valgus tagasi.',
  c.kids ? 'Lapsed pole kunagi nii palju tekke ühes toas näinud.' : '',
  c.f.school ? 'Koolilaps kirjutab juba Pimeduse Kohtu põhikirja.' : ''
 ]),
 tiers:[
  {min:92, t:'Küünlaõhtu legend', x:'Teie pere läbis 62 tundi pimedust nagu matka, mida keegi juba kordama kipub. Naabrid mäletavad teid veel aastaid.'},
  {min:74, t:'Kogenud matkapere', x:'Mõni asi läks käest, aga pere oli kogu aeg koos, soe ja üsna rõõmus. Järgmine kord läheb veel paremini.'},
  {min:50, t:'Elasime üle ja räägime sellest', x:'Läks pingeliseks, aga tulite välja ja saate selle üle naerda. Natuke ettevalmistust teeks järgmise korra lihtsamaks.'},
  {min:0, t:'Õppetund pimedas', x:'See oli raske ja just selleks mäng tehtigi. Hea uudis: suure osa sellest parandab kahe-kolme asjaga kapis.'}
 ]
};

/* ===== Mootor ===== */
const clamp = v => Math.max(0, Math.min(100, v));
function ctx(st){
  const f = st.fam, kids = f.baby + f.small + f.school + f.teen;
  const H = HOMES[st.home] || HOMES.paneel;
  const heat = H.fireOk ? st.heat : 'ei';
  return {f, kids, people:f.adults + kids, home:st.home, H, heat, fire:heat === 'ahi' || heat === 'kamin', pets:!!(f.dog || f.cat)};
}
const freshPrep = () => ({done:{}, list:[], shop:null, batt:null});
const kidMult = st => Math.min(1.5, 1 + .2 * (st.fam.small + st.fam.baby));
const taskMin = (st, id) => Math.round(ITEM[id].min * kidMult(st) / 5) * 5;
function usedMin(st){
  let u = 0;
  for(const id in st.prep.done) if(st.prep.done[id]) u += taskMin(st, id);
  if(st.prep.shop) u += st.prep.shop.took;
  return u;
}
const shopGot = (pr, id) => !!(pr.shop && pr.shop.res.some(r => r.id === id && r.st === 'ok'));
function computePicks(st){
  const c = ctx(st), pr = st.prep, out = [];
  visibleItems(c).forEach(it => {
    if(it.where === 'home'){
      if(!pr.done[it.id]) return;
      if(it.id === 'light' && !(pr.batt || shopGot(pr, 'batt'))) return;
      out.push(it.id);
    } else if(it.id !== 'batt' && shopGot(pr, it.id)) out.push(it.id);
  });
  return out;
}
function doShop(st, rnd){
  rnd = rnd || Math.random;
  const c = ctx(st), vis = visibleItems(c).map(i => i.id);
  const list = st.prep.list.filter(id => vis.includes(id));
  const remaining = BUDGET - usedMin(st);
  const queue = Math.round(rnd() * SHOP_QUEUE_MAX / 5) * 5;
  let t = SHOP_BASE + queue;
  const res = list.map(id => {
    t += SHOP_PER_ITEM;
    if(t > remaining) return {id, st:'late'};
    return {id, st:rnd() < ITEM[id].p ? 'ok' : 'out'};
  });
  st.prep.shop = {queue, res, took:Math.min(t, remaining)};
}
function startMeters(picks){
  const m = Object.assign({}, BASE);
  picks.forEach(id => { const fx = ITEM[id].fx; for(const k in fx) m[k] = clamp(m[k] + fx[k]); });
  return m;
}
function addFx(m, fx){
  const d = {};
  for(const k in fx){ const b = m[k]; m[k] = clamp(m[k] + Math.round(fx[k])); d[k] = m[k] - b; }
  return d;
}
function sceneDrift(sc, st){
  const c = ctx(st), d = Object.assign({}, sc.drift || {});
  const f = Math.max(.5, Math.min(1.75, c.people / 4));
  if(d.water < 0) d.water *= f * c.H.waterMul;
  if(d.food < 0) d.food *= f;
  if(d.warmth < 0) d.warmth *= c.heat === 'ahi' ? .5 : c.heat === 'kamin' ? .7 : c.H.warmMul;
  if(Object.keys(d).length){
    if(c.f.small) d.mood = (d.mood || 0) - 2;
    if(c.f.baby && !st.picks.includes('baby')) d.mood = (d.mood || 0) - 3;
  }
  return d;
}
const visibleOpts = (sc, c) => sc.opts.filter(o => !o.show || o.show(c));
function modOk(md, st, c){
  if(md.show && !md.show(c)) return false;
  if(md.has && !st.picks.includes(md.has)) return false;
  if(md.not && st.picks.includes(md.not)) return false;
  if(md.test && !md.test(st, c)) return false;
  return true;
}
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
function resolve(st, sc, optId){
  const c = ctx(st), opts = visibleOpts(sc, c);
  const opt = opts.find(o => o.id === optId);
  const total = {}, lines = [];
  const add = fx => { for(const k in fx) total[k] = (total[k] || 0) + fx[k]; };
  add(V(opt.fx, c) || {});
  if(opt.req) bump(st.used, opt.req);
  opts.forEach(o => { if(o.req && !st.picks.includes(o.req)) bump(st.missed, o.req); });
  [].concat(opt.mods || [], sc.mods || []).forEach(md => {
    if(!modOk(md, st, c)) return;
    const fx = V(md.fx, c) || {};
    add(fx);
    if(md.text) lines.push({text:V(md.text, c), fx});
    if(md.has) bump(st.used, md.has);
    if(md.not) bump(st.missed, md.not);
  });
  st.comm += opt.comm || 0;
  const deltas = addFx(st.m, total);
  st.log.push(optId);
  st.hist.push(METERS.reduce((a, k) => a + st.m[k], 0) / METERS.length);
  return {optId, lines, deltas};
}
function rawScore(st){
  const h = st.hist.length ? st.hist : [METERS.reduce((a, k) => a + st.m[k], 0) / METERS.length];
  return h.reduce((a, b) => a + b, 0) / h.length * .85 + Math.min(3, st.comm) * 5 - (st.crises || 0) * 2;
}
const finalScore = st => Math.max(0, Math.min(100, Math.round((rawScore(st) - SCORE_LO) / (SCORE_HI - SCORE_LO) * 100)));
const tierOf = s => END.tiers.find(t => s >= t.min);
function beginRun(st){
  st.picks = computePicks(st);
  st.m = startMeters(st.picks); st.comm = st.picks.includes('aino') ? 1 : 0;
  st.log = []; st.hist = []; st.used = {}; st.missed = {}; st.crises = 0;
}

/* ===== Olek ===== */
let S;
const DEF_FAM = {adults:2, baby:0, small:1, school:1, teen:0, dog:true, cat:false};
function loadSetup(){
  try{ const s = JSON.parse(localStorage.getItem('vool-setup3') || 'null'); if(s && s.fam && HOMES[s.home]) return s; }catch(e){}
  return {fam:Object.assign({}, DEF_FAM), home:'paneel', heat:'ei'};
}
function saveSetup(){ try{ localStorage.setItem('vool-setup3', JSON.stringify({fam:S.fam, home:S.home, heat:S.heat})); }catch(e){} }
function fresh(){
  const su = loadSetup();
  return {screen:'title', fam:su.fam, home:su.home, heat:su.heat, prep:freshPrep(), picks:[], i:0, m:Object.assign({}, BASE), comm:0,
          log:[], hist:[], used:{}, missed:{}, res:null, drift:{}, fun:null, again:null, note:'', fb:'', shareMsg:'', shareFallback:''};
}
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const dchips = d => Object.keys(d).filter(k => d[k] !== 0).map(k => `<span class="dc ${d[k] > 0 ? 'up' : 'dn'}">${ML[k]} ${d[k] > 0 ? '+' : ''}${d[k]}</span>`).join('');
function famSummary(c){
  const parts = [`${c.f.adults} ${p(c.f.adults, 'täiskasvanu', 'täiskasvanut')}`];
  if(c.f.baby) parts.push(`${c.f.baby} ${p(c.f.baby, 'beebi', 'beebit')}`);
  if(c.f.small) parts.push(`${c.f.small} ${p(c.f.small, 'väikelaps', 'väikelast')}`);
  if(c.f.school) parts.push(`${c.f.school} ${p(c.f.school, 'koolilaps', 'koolilast')}`);
  if(c.f.teen) parts.push(`${c.f.teen} ${p(c.f.teen, 'teismeline', 'teismelist')}`);
  if(c.f.dog) parts.push('koer');
  if(c.f.cat) parts.push('kass');
  return parts.join(', ') + ' · ' + c.H.n.toLowerCase();
}
function tipHtml(tip){
  if(!tip) return '';
  const s = SRC[tip.src];
  return `<div class="tip ${tip.src === 'game' ? 'game' : ''}"><b>${esc(s.lab)}</b>${esc(tip.text)}${s.url ? `<span class="src">Allikas: <a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a></span>` : ''}</div>`;
}

/*HOUSE*/
/* ===== Vaated ===== */
function viewTitle(){
  return `<section class="hero">
    <p class="kicker">Mäng ühest väga pimedast nädalavahetusest</p>
    <h1>Vool <span class="flick">ära!</span></h1>
    <p class="lead">Torm võtab vooluvõrgu maha. Sinu pere, sinu kodu ja 62 tundi pimedust. Kaheksa otsust, umbes kuus minutit. Nalja saab palju, aga valikud on päris.</p>
    <div class="cta-row"><button class="btn" type="button" data-a="start">Alusta</button></div>
    <p class="meta">Iga nõuande juures on allikas. Midagi ei saadeta serverisse.</p>
  </section>`;
}
const STEP_ROWS = [
  ['adults','Täiskasvanud','', 1, 4],
  ['baby','Beebi','alla 1 aasta', 0, 3],
  ['small','Väikelaps','1-6 aastat', 0, 4],
  ['school','Koolilaps','7-12 aastat', 0, 4],
  ['teen','Teismeline','13-17 aastat', 0, 4]
];
function viewSetup(){
  const c = ctx(S);
  const rows = STEP_ROWS.map(([k, l, s, mn, mx]) => `<div class="row">
      <span class="lbl"><strong>${l}</strong>${s ? `<span>${s}</span>` : ''}</span>
      <span class="step"><button type="button" data-a="inc" data-k="${k}" data-d="-1" aria-label="${l}: vähem" ${S.fam[k] <= mn ? 'disabled' : ''}>−</button>
      <output aria-live="polite">${S.fam[k]}</output>
      <button type="button" data-a="inc" data-k="${k}" data-d="1" aria-label="${l}: rohkem" ${S.fam[k] >= mx ? 'disabled' : ''}>+</button></span></div>`).join('');
  const ch = (a, v, cur, title, sub) => `<button type="button" class="choice" data-a="${a}" data-v="${v}" aria-pressed="${cur === v}"><span class="dot" aria-hidden="true"></span><span><strong>${title}</strong>${sub ? `<span class="s">${sub}</span>` : ''}</span></button>`;
  return `<section class="setup">
    <h2 tabindex="-1" id="h">Kes teie peres on?</h2>
    <p class="lead">Lugu muutub vastavalt sellele, keda sa pimedas hoiad ja kus te elate.</p>
    <div class="rows">${rows}</div>
    <h3>Lemmikloomad</h3>
    <div class="toggles">
      <button type="button" class="tog" data-a="pet" data-k="dog" aria-pressed="${S.fam.dog}">Koer</button>
      <button type="button" class="tog" data-a="pet" data-k="cat" aria-pressed="${S.fam.cat}">Kass</button>
    </div>
    <h3>Kus te elate?</h3>
    <div class="seg">${Object.keys(HOMES).map(k => ch('home', k, S.home, HOMES[k].n, HOMES[k].s)).join('')}</div>
    ${c.H.fireOk ? `<h3>Kas kodus on midagi, mis kütab ilma elektrita?</h3>
    <div class="seg">
      ${ch('heat','ahi',S.heat,'Jah, puuahi või pliit','Kogu maja või korteri põhiküte.')}
      ${ch('heat','kamin',S.heat,'Jah, kamin','Soojendab peamiselt ühte tuba.')}
      ${ch('heat','ei',S.heat,'Ei','Gaasikatel, keskküte, soojuspump või elekter: kõik vajavad voolu.')}
    </div>` : ''}
    <p class="sum">Teie peres on <b>${c.people} ${p(c.people,'inimene','inimest')}</b>. Ametlik soovitus: 3 liitrit joogivett inimese kohta päevas, teil seega <b>${c.people*3} liitrit päevas</b> ja <b>${c.people*21} liitrit nädalas</b>.</p>
    <div class="cta-row"><button class="btn" type="button" data-a="toPrep">Edasi: tormihoiatus</button></div>
  </section>`;
}
function viewPrep(){
  const c = ctx(S), pr = S.prep, items = visibleItems(c);
  const used = usedMin(S), rem = BUDGET - used;
  const home = items.filter(i => i.where === 'home').map(it => {
    const on = !!pr.done[it.id], tm = taskMin(S, it.id), dis = !on && tm > rem;
    let extra = '';
    if(it.id === 'light' && on){
      extra = pr.batt ? '<span class="ok">Taskulambid leitud ja patareid töötavad.</span>'
        : shopGot(pr, 'batt') ? '<span class="ok">Patareid tõid poest. Taskulambid töötavad.</span>'
        : '<span class="warn">Taskulambid leitud, aga patareid on tühjad. Patareisid saab poest.</span>';
    }
    return `<li><button type="button" class="pick" data-a="task" data-id="${it.id}" aria-pressed="${on}" ${dis ? 'aria-disabled="true"' : ''}>
      <span class="box" aria-hidden="true"></span>
      <span><strong>${esc(it.n)}<span class="mins">${tm} min</span></strong><span class="s">${esc(V(it.d, c))}</span>${extra}</span></button></li>`;
  }).join('');
  let shop;
  if(!pr.shop){
    const sitems = items.filter(i => i.where === 'shop');
    const n = pr.list.filter(id => sitems.some(i => i.id === id)).length;
    const lo = SHOP_BASE + SHOP_PER_ITEM * n, hi = lo + SHOP_QUEUE_MAX;
    const li = sitems.map(it => {
      const on = pr.list.includes(it.id), [ot, oc] = oddsText(it.p);
      return `<li><button type="button" class="pick" data-a="slist" data-id="${it.id}" aria-pressed="${on}">
        <span class="box" aria-hidden="true"></span>
        <span><strong>${esc(it.n)}<span class="odds ${oc}">${ot}</span></strong></span></button></li>`;
    }).join('');
    shop = `<p class="shopnote">${c.kids && c.f.adults > 1 ? 'Kui sina lähed poodi, jääb teine täiskasvanu lastega ja kodused toimetused ootavad sind. ' : ''}Poeskäik võtab ${n ? `umbes ${lo}-${hi} minutit, olenevalt sabast` : `vähemalt ${SHOP_BASE} minutit`}. Kõike ei pruugi saada: teised valmistuvad samuti.${n && hi > rem ? ' Kui saba on pikk, ei jõua kõike osta.' : ''}</p>
      <ul class="picks">${li}</ul>
      <div class="cta-row"><button class="btn ghost" type="button" data-a="goShop" ${n && rem >= lo - SHOP_PER_ITEM * (n - 1) ? '' : 'disabled'}>Mine poodi</button></div>`;
  } else {
    const s = pr.shop;
    const q = s.queue >= 25 ? 'Kassas oli väga pikk saba.' : s.queue >= 10 ? 'Poes oli tavalisest rohkem rahvast.' : 'Poes oli üllatavalt rahulik.';
    const lab = {ok:'Ostetud', out:'Otsas', late:'Ei jõudnud'};
    const li = s.res.map(r => `<li><span class="st ${r.st}">${lab[r.st]}</span><span>${esc(ITEM[r.id].n)}</span></li>`).join('');
    shop = `<p class="shopnote">${q} Kokku kulus ${s.took} minutit.</p>${li ? `<ul class="shopres">${li}</ul>` : ''}`;
  }
  return `<section>
    ${houseSvg(S, 'prep')}
    <div class="when"><span class="t">${hhmm(PREP_START + used)}</span><span class="d">${esc(dlabel(0))}</span></div>
    <h2 class="st" tabindex="-1" id="h">${PREP.title}</h2>
    <div class="story"><p>${esc(PREP.text(c))}</p></div>
    <p class="home">${esc(PREP.home(c))}</p>
    <div class="budget" aria-live="polite"><div class="row1"><span>Aega tormini</span><b>${rem} min</b></div>
      <div class="tbar"><i class="${rem < 30 ? 'low' : ''}" style="width:${Math.max(0, rem / BUDGET * 100)}%"></i></div></div>
    <div class="secth"><h3>Kodus</h3><span>kindel, aga võtab aega</span></div>
    ${kidMult(S) > 1 ? `<p class="shopnote">${p(c.f.small + c.f.baby, 'Väike laps', 'Väikesed lapsed')} ${p(c.f.small + c.f.baby, 'tahab', 'tahavad')} samal ajal tähelepanu, nii et kõik võtab kauem.</p>` : ''}
    <ul class="picks">${home}</ul>
    <div class="secth"><h3>Poeskäik</h3><span>ainult üks kord, tulemus pole kindel</span></div>
    ${shop}
    ${S.confirm ? `<div class="echo crisis" id="confirm" role="alert"><b>Kindel?</b>${!pr.shop ? '<p>Sa ei käinud poes: toitu, raadiot, matkapliiti ega sularaha juurde ei tule.</p>' : ''}${rem >= 10 ? `<p>Aega on veel ${rem} minutit.</p>` : ''}<p>Vajuta uuesti „Oota tormi“, kui oled valmis.</p></div>` : ''}
    <div class="cta-row"><button class="btn" type="button" data-a="begin">Oota tormi</button>
      <button class="btn ghost" type="button" data-a="toSetup">Muuda peret või kodu</button></div>
    <p class="note">Kui vajutad „Oota tormi“, lähevad tuled ära.</p>
  </section>`;
}
function viewScene(){
  const sc = SC[S.i], c = ctx(S), opts = visibleOpts(sc, c);
  const dr = dchips(S.drift);
  const head = `${houseSvg(S, 'scene')}<div class="when"><span class="t">${sc.time}</span><span class="d">${esc(dlabel(sc.day))} · ${S.i + 1}/${SC.length}</span></div>
    <h2 class="st" tabindex="-1" id="h">${esc(V(sc.title, c))}</h2>
    <div class="story"><p>${esc(V(sc.text, c))}</p></div>
    ${(S.crisis || []).length ? `<div class="echo crisis"><b>Kriis</b>${S.crisis.map(t => `<p>${esc(t)}</p>`).join('')}</div>` : ''}
    ${(S.echo || []).length ? `<div class="echo"><b>Varasem otsus annab tunda</b>${S.echo.map(t => `<p>${esc(t)}</p>`).join('')}</div>` : ''}
    ${dr ? `<p class="drift"><span>Vahepeal:</span> ${dr}</p>` : ''}`;
  if(!S.res){
    const li = opts.map((o, i) => {
      const locked = o.req && !S.picks.includes(o.req);
      return `<li><button type="button" class="opt" data-a="pick" data-id="${o.id}" ${locked ? 'disabled' : ''}>
        <span class="n" aria-hidden="true">${i + 1}</span>
        <span>${esc(V(o.t, c))}${locked ? `<span class="lock">Vaja: ${esc(ITEM[o.req].n.toLowerCase())} (seda pole)</span>` : ''}</span></button></li>`;
    }).join('');
    return `<section>${head}<ul class="opts">${li}</ul></section>`;
  }
  const r = S.res, o = opts.find(x => x.id === r.optId);
  const lines = r.lines.map(l => {
    const net = Object.values(l.fx || {}).reduce((a, b) => a + b, 0);
    return `<p class="more ${net < 0 ? 'less' : ''}">${esc(l.text)}</p>`;
  }).join('');
  const last = S.i === SC.length - 1;
  return `<section>${head}
    <div class="res" aria-live="polite">
      <p class="you">Sinu valik: ${esc(V(o.t, c))}</p>
      <p>${esc(V(o.r, c))}</p>
      ${lines}
      <div class="deltas">${dchips(r.deltas)}</div>
      ${tipHtml(o.tip)}
    </div>
    <div class="next"><button class="btn" type="button" data-a="next" id="nx">${last ? 'Vaata, kuidas läks' : 'Edasi'}</button></div>
  </section>`;
}
function viewEnd(){
  const c = ctx(S), score = finalScore(S), tier = tierOf(score), items = visibleItems(c).filter(i => i.id !== 'batt');
  const sorted = METERS.slice().sort((a, b) => S.m[b] - S.m[a]);
  const helped = items.filter(i => S.picks.includes(i.id) && S.used[i.id]).map(i => `<li class="chip">${esc(i.n)} <em>${S.used[i.id]}×</em></li>`).join('');
  const missed = items.filter(i => !S.picks.includes(i.id) && S.missed[i.id]).sort((a, b) => S.missed[b.id] - S.missed[a.id]).slice(0, 3)
    .map(i => { const s = SRC[i.tip.src]; return `<li><strong>${esc(i.n)}</strong><span>${esc(i.tip.text)}${s.url ? ` <a href="${s.url}" target="_blank" rel="noopener">Allikas</a>` : ''}</span></li>`; }).join('');
  const rate = [1,2,3,4,5].map(n => `<button type="button" data-a="rate" data-n="${n}" aria-pressed="${S.fun === n}" aria-label="${n}">${n}</button>`).join('');
  const ctas = [];
  if(CONFIG.ctas.share) ctas.push('<button class="btn" type="button" data-a="share">Saada sõbrale</button>');
  if(CONFIG.ctas.again) ctas.push('<button class="btn ghost" type="button" data-a="again">Mängi uuesti</button>');
  if(CONFIG.ctas.app) ctas.push(`<a class="btn ghost" href="${CONFIG.appUrl}" target="_blank" rel="noopener">Ole valmis! äpp</a>`);
  if(CONFIG.ctas.stock && CONFIG.stockUrl) ctas.push(`<a class="btn ghost" href="${CONFIG.stockUrl}" target="_blank" rel="noopener">Täienda varusid</a>`);
  const srcs = Object.values(SRC).filter(s => s.url).map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a></li>`).join('');
  return `<section>
    ${houseSvg(S, 'end')}
    <div class="when"><span class="t">08:12</span><span class="d">${esc(dlabel(3))}</span></div>
    <h2 class="st" tabindex="-1" id="h">${esc(tier.t)}</h2>
    <div class="score"><b>${score}</b><span>/ 100</span></div>
    <div class="story"><p>${esc(END.text(c))}</p><p>${esc(tier.x)}</p>
    ${S.crises ? `<p class="home">Kriisihetki kokku: <b>${S.crises}</b>. Iga tühjaks saanud varu tegi järgmised tunnid raskemaks.</p>` : ''}
    <p class="home">Pere tugevaim külg: <b>${ML[sorted[0]]}</b>. Kõige õhem: <b>${ML[sorted[sorted.length - 1]]}</b>.</p></div>
    <div class="sec"><h3>Mis ettevalmistusest abiks oli</h3>${helped ? `<ul class="chips">${helped}</ul>` : '<p class="note">Seekord polnud ettevalmistusest abi. Proovi teisiti.</p>'}</div>
    <div class="sec"><h3>Mis jäi puudu</h3>${missed ? `<ul class="miss">${missed}</ul>` : '<p class="note">Olulisem oli olemas.</p>'}
      <p class="note"><a href="${CONFIG.guideUrl}" target="_blank" rel="noopener">Vaata ametlikku varude nimekirja: olevalmis.ee</a></p></div>
    <div class="sec"><div class="cta-row">${ctas.join('')}</div>
      <p class="note">Näita seda mõnele teisele lapsevanemale.</p><p class="toast" role="status">${esc(S.shareMsg)}</p>
      ${S.shareFallback ? `<input class="share" id="sh" readonly value="${esc(S.shareFallback)}" aria-label="Kopeeri see tekst käsitsi">` : ''}
    </div>
    <div class="sec"><h3>Kui lõbus see oli?</h3>
      <div class="rate" role="group" aria-label="Kui lõbus see oli?">${rate}</div>
      <div class="scale"><span>Igav</span><span>Tahan veel</span></div>
      <label class="q">Mängiksid veel ühe stsenaariumi (näiteks suvine torm või vee katkemine)?</label>
      <div class="yn"><button type="button" data-a="again2" data-v="1" aria-pressed="${S.again === 1}">Jah</button><button type="button" data-a="again2" data-v="0" aria-pressed="${S.again === 0}">Ei</button></div>
      <label class="q" for="note">Üks asi, mida muudaksid (valikuline)</label>
      <textarea id="note" maxlength="300">${esc(S.note)}</textarea>
      <div class="cta-row"><button class="btn ghost" type="button" data-a="send" ${S.fun ? '' : 'disabled'}>Saada tagasiside</button>
        <button class="btn ghost" type="button" data-a="toSetup">Muuda peret või kodu</button></div>
      <p class="toast" role="status">${esc(S.fb)}</p>
    </div>
    <details class="srcs"><summary>Kõik allikad</summary><ul>${srcs}</ul></details>
  </section>`;
}

/* ===== HUD ===== */
function buildHud(){
  $('#hud').innerHTML = `<div class="meters">${METERS.map(k =>
    `<div class="m" data-k="${k}" role="img"><div class="ml"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg><span>${ML[k]}</span></div><div class="bar"><i></i></div></div>`).join('')}</div>
    <div class="clock"><span id="clk"></span><div class="track" aria-hidden="true"><i id="trk"></i>${SC.map(s => `<b style="left:${(s.hour / TOTAL_H * 100).toFixed(1)}%" data-h="${s.hour}"></b>`).join('')}</div></div>`;
}
function updateHud(){
  const h = $('#hud');
  const show = ['prep','scene','end'].includes(S.screen);
  h.hidden = !show;
  $('#famline').textContent = S.screen === 'title' || S.screen === 'setup' ? '' : famSummary(ctx(S));
  if(!show) return;
  if(!h.firstChild) buildHud();
  const mm = S.screen === 'prep' ? startMeters(computePicks(S)) : S.m;
  METERS.forEach(k => {
    const el = h.querySelector(`.m[data-k="${k}"]`);
    el.querySelector('i').style.width = mm[k] + '%';
    el.classList.toggle('low', mm[k] < 25);
    el.setAttribute('aria-label', `${ML[k]} ${mm[k]}/100`);
  });
  let hour = 0, label = 'Enne tormi';
  if(S.screen === 'prep'){ const rem = BUDGET - usedMin(S); label = `Aega tormini ${rem} min${S.prep.shop ? '' : ' · poes käimata'}`; }
  if(S.screen === 'scene'){ hour = SC[S.i].hour; label = `Pimedas ${hour} h`; }
  if(S.screen === 'end'){ hour = TOTAL_H; label = `Pimedas ${TOTAL_H} h`; }
  $('#clk').textContent = label;
  $('#trk').style.width = (hour / TOTAL_H * 100) + '%';
  h.querySelectorAll('.track b').forEach(b => b.classList.toggle('on', +b.dataset.h <= hour && S.screen !== 'prep'));
  document.documentElement.style.setProperty('--glow', (S.screen === 'prep' ? .55 : .15 + mm.power / 100 * .55).toFixed(2));
}

function render(){
  $('#main').innerHTML = S.screen === 'title' ? viewTitle()
    : S.screen === 'setup' ? viewSetup()
    : S.screen === 'prep' ? viewPrep()
    : S.screen === 'scene' ? viewScene()
    : viewEnd();
  updateHud();
  try{ window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => JSON.parse(JSON.stringify(S))); }catch(e){}
}
function focusHeading(){ const h = $('#h'); if(h) h.focus({preventScroll:true}); window.scrollTo(0, 0); }
function keep(fn){ const y = window.scrollY; fn(); render(); window.scrollTo(0, y); }
function enterScene(i){
  S.i = i; S.res = null; S.screen = 'scene';
  const e = sceneEntry(S, i);
  S.echo = e.echo; S.crisis = e.crisis;
  S.crises = (S.crises || 0) + e.crisis.length;
  S.drift = addFx(S.m, e.d);
}
function refocus(sel){ const b = document.querySelector(sel); if(b) b.focus({preventScroll:true}); }

/* ===== Tegevused ===== */
const A = {
  start(){ S.screen = 'setup'; render(); focusHeading(); },
  inc(d){ keep(() => { const row = STEP_ROWS.find(r => r[0] === d.k); S.fam[d.k] = Math.max(row[3], Math.min(row[4], S.fam[d.k] + (+d.d))); saveSetup(); }); refocus(`[data-a="inc"][data-k="${d.k}"][data-d="${d.d}"]`); },
  pet(d){ keep(() => { S.fam[d.k] = !S.fam[d.k]; saveSetup(); }); },
  home(d){ keep(() => { S.home = d.v; saveSetup(); }); },
  heat(d){ keep(() => { S.heat = d.v; saveSetup(); }); },
  toSetup(){ S.screen = 'setup'; S.res = null; render(); focusHeading(); },
  toPrep(){ S.screen = 'prep'; render(); focusHeading(); },
  task(d){
    keep(() => { S.confirm = false;
      const pr = S.prep;
      if(pr.done[d.id]) pr.done[d.id] = false;
      else if(taskMin(S, d.id) <= BUDGET - usedMin(S)){
        pr.done[d.id] = true;
        if(d.id === 'light' && pr.batt === null) pr.batt = Math.random() < .5;
      }
    });
    refocus(`[data-a="task"][data-id="${d.id}"]`);
  },
  slist(d){
    if(S.prep.shop) return;
    keep(() => { S.confirm = false; const l = S.prep.list, i = l.indexOf(d.id); if(i >= 0) l.splice(i, 1); else l.push(d.id); });
    refocus(`[data-a="slist"][data-id="${d.id}"]`);
  },
  goShop(){ if(S.prep.shop || !S.prep.list.length) return; keep(() => { S.confirm = false; doShop(S); }); },
  begin(){
    const rem = BUDGET - usedMin(S);
    if(!S.confirm && (!S.prep.shop || rem >= 10)){
      S.confirm = true; keep(() => {});
      const w = $('#confirm'); if(w) w.scrollIntoView({block:'center', behavior:REDUCED ? 'auto' : 'smooth'});
      return;
    }
    S.confirm = false;
    beginRun(S);
    S.fun = null; S.again = null; S.note = ''; S.fb = ''; S.shareMsg = ''; S.shareFallback = '';
    const go = () => { enterScene(0); render(); focusHeading(); };
    if(FAST || REDUCED){ go(); return; }
    const o = $('#blackout'); o.className = 'on';
    setTimeout(go, 700); setTimeout(() => { o.className = ''; }, 1500);
  },
  pick(d){
    if(S.res) return;
    const sc = SC[S.i], o = visibleOpts(sc, ctx(S)).find(x => x.id === d.id);
    if(!o || (o.req && !S.picks.includes(o.req))) return;
    S.res = resolve(S, sc, d.id);
    render();
    const nx = $('#nx'); if(nx){ nx.focus({preventScroll:true}); nx.scrollIntoView({block:'nearest', behavior:REDUCED ? 'auto' : 'smooth'}); }
  },
  next(){
    if(S.i < SC.length - 1){ enterScene(S.i + 1); render(); focusHeading(); }
    else { S.screen = 'end'; S.res = null; render(); focusHeading(); }
  },
  rate(d){ keepNote(); keep(() => { S.fun = +d.n; }); },
  again2(d){ keepNote(); keep(() => { S.again = +d.v; }); },
  send(){
    keepNote();
    const score = finalScore(S), c = ctx(S);
    const payload = {v:3, t:Date.now(), fam:S.fam, home:S.home, heat:c.heat, prep:{done:S.prep.done, shop:S.prep.shop}, picks:S.picks, choices:S.log, score,
                     fun:S.fun, again:S.again, note:S.note.slice(0, 300)};
    try{ const all = JSON.parse(localStorage.getItem('vool-fb') || '[]'); all.push(payload); localStorage.setItem('vool-fb', JSON.stringify(all)); }catch(e){}
    if(CONFIG.feedbackEndpoint){
      try{ fetch(CONFIG.feedbackEndpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), keepalive:true}).catch(() => {}); }catch(e){}
      S.fb = 'Aitäh! Vastus saadetud.';
    } else S.fb = 'Aitäh! Vastus jäi ainult sinu brauserisse (testversioon).';
    keep(() => {});
  },
  again(){ S.prep = freshPrep(); S.picks = []; S.res = null; S.screen = 'prep'; render(); focusHeading(); },
  async share(){
    keepNote();
    const score = finalScore(S), tier = tierOf(score);
    const url = CONFIG.shareUrl || location.href.split('#')[0];
    const text = `Elasin mängus Vool ära! üle 62 tundi pimedust ja sain tiitli „${tier.t}“ (${score}/100). Proovi ise oma perega:`;
    try{ if(navigator.share){ await navigator.share({title:'Vool ära!', text, url}); return; } }
    catch(e){ if(e && e.name === 'AbortError') return; }
    try{ await navigator.clipboard.writeText(text + ' ' + url); S.shareMsg = 'Tekst kopeeritud. Kleebi see sõbrale.'; S.shareFallback = ''; }
    catch(e){ S.shareMsg = 'Kopeeri see tekst käsitsi:'; S.shareFallback = text + ' ' + url; }
    keep(() => {});
    const sh = $('#sh'); if(sh){ sh.focus(); sh.select(); }
  }
};
function keepNote(){ const n = $('#note'); if(n) S.note = n.value; }

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if(!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
  const fn = A[b.dataset.a]; if(fn) fn(b.dataset);
});
document.addEventListener('keydown', e => {
  if(S.screen === 'scene' && !S.res && /^[1-9]$/.test(e.key) && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')){
    const o = visibleOpts(SC[S.i], ctx(S))[+e.key - 1];
    if(o && !(o.req && !S.picks.includes(o.req))) A.pick({id:o.id});
  }
});

function boot(d){
  S = (d && d.screen && d.fam && d.prep && HOMES[d.home]) ? Object.assign(fresh(), d) : fresh();
  render();
}
window.__vool = {get state(){ return S; }, set state(v){ S = v; }, SC, ITEMS, HOMES, ctx, visibleOpts, visibleItems, resolve, sceneDrift, startMeters, addFx,
  rawScore, finalScore, tierOf, A, fresh, freshPrep, doShop, computePicks, usedMin, taskMin, beginRun, sceneEntry, houseSvg, BUDGET, DATES};
if(window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot);
else boot((window.claude && window.claude.hot && window.claude.hot.data) || {});
})();
