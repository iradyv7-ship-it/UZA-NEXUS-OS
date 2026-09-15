import type { Module } from "./types";

/**
 * Road craft — led with the traffic police. Every candidate already holds a
 * licence; what is missing is practised judgement in real Kigali traffic.
 */
export const roadModules: Module[] = [
  {
    id: "r1",
    track: "road",
    code: "R1",
    tier: "core",
    partner: { en: "Traffic Police session", rw: "Icyiciro cya Polisi y'umuhanda" },
    title: {
      en: "Signs, markings and what they really ask of you",
      rw: "Ibimenyetso, imirongo, n'ibyo bigusaba by'ukuri",
    },
    why: {
      en: "You passed the theory years ago. On the road what matters is reading a sign early enough to act calmly, not braking hard when it is already beside you.",
      rw: "Watsinze isuzuma ry'inyigisho mu myaka yashize. Ku muhanda icy'ingenzi ni ugusoma ikimenyetso hakiri kare ngo ubigenze utuje, aho gukanda amaferi cyane igihe kigeze iruhande rwawe.",
    },
    minutes: 60,
    delivery: "both",
    remember: [
      { en: "Red circle = forbidden. Blue circle = obligatory. Triangle = warning.", rw: "Uruziga rutukura = birabujijwe. Uruziga rw'ubururu = birategetswe. Impande eshatu = kuburira." },
      { en: "A continuous white line is never crossed — not for a slow truck, not for a passenger waving.", rw: "Umurongo wera udacikamo ntiwambukwa — nubwo hari ikamyo igenda buhoro, nubwo umugenzi akubamira." },
    ],
    lessons: [
      {
        id: "r1l1",
        title: { en: "Reading the road three hundred metres ahead", rw: "Gusoma umuhanda metero magana atatu imbere" },
        body: [
          {
            en: "Experienced drivers look at the car in front. Professional drivers look past it: the junction, the pedestrian at the kerb, the moto about to change lane.",
            rw: "Abashoferi b'inararibonye bareba imodoka iri imbere. Abashoferi b'umwuga bareba kure yayo: ku isangano, ku munyamaguru uri ku nkombe, kuri moto igiye guhindura umurongo.",
          },
          {
            en: "Give yourself time and every decision becomes cheap: no hard braking, no fuel or battery wasted, no argument, no fine.",
            rw: "Iyo wihaye igihe, buri cyemezo kigira ikiguzi gito: nta maferi akaze, nta lisansi cyangwa umuriro upfa ubusa, nta makimbirane, nta hazabu.",
          },
        ],
        practice: {
          en: "On your next trip, name out loud every sign you pass before you reach it. Do it for ten minutes.",
          rw: "Mu rugendo rukurikira, vuga mu ijwi riranguruye buri kimenyetso unyuraho mbere yuko ukigeraho. Bikore iminota icumi.",
        },
        facilitator: {
          en: "Project ten photographs of real Kigali junctions. Ask the room what they would do, then let the police officer answer.",
          rw: "Erekana amafoto icumi y'amasangano nyayo yo mu Kigali. Baza itsinda icyo bakora, hanyuma ureke umupolisi asubize.",
        },
      },
      {
        id: "r1l2",
        title: { en: "Who goes first", rw: "Ninde ubanza kugenda" },
        body: [
          {
            en: "At a roundabout, the vehicle already in the circle goes first. At an unmarked crossing, the vehicle on your right goes first. A pedestrian on a zebra crossing always goes first.",
            rw: "Ku ruziga (rond-point), imodoka isanzwe iri mu ruziga niyo ibanza. Ku isangano ridafite ibimenyetso, imodoka iri iburyo bwawe niyo ibanza. Umunyamaguru uri ku murongo wa zebra ahora abanza.",
          },
          {
            en: "Priority is something you give, not something you take. A driver who insists on their right and causes a crash still loses the car and the income.",
            rw: "Uburenganzira bwo kubanza ni ikintu utanga, si ikintu wifatira. Umushoferi wibandaho maze agatera impanuka, aracyabura imodoka n'amafaranga.",
          },
        ],
        practice: {
          en: "Draw the roundabout nearest your home and mark, with arrows, who yields to whom.",
          rw: "Shushanya uruziga ruri hafi y'iwanyu maze ushyireho utumenyetso twerekana uwemerera undi kubanza.",
        },
      },
    ],
    quiz: [
      {
        id: "r1q1",
        question: { en: "You reach a roundabout and a car is already circulating on your left. What do you do?", rw: "Ugeze ku ruziga usanga imodoka isanzwe izenguruka ibumoso bwawe. Ukora iki?" },
        options: [
          { en: "Enter quickly before it arrives", rw: "Winjira vuba mbere yuko igera" },
          { en: "Wait and let it pass", rw: "Utegereza ukayireka igahita" },
          { en: "Sound the horn and enter", rw: "Uvuza ihoni maze winjire" },
        ],
        answer: 1,
        explain: { en: "Traffic already in the roundabout has priority. Waiting two seconds costs nothing.", rw: "Ibinyabiziga bisanzwe biri mu ruziga nibyo bibanza. Gutegereza amasegonda abiri nta kiguzi bifite." },
      },
      {
        id: "r1q2",
        question: { en: "A blue circular sign means…", rw: "Ikimenyetso cy'ubururu kizengurutse gisobanura…" },
        options: [
          { en: "Something is forbidden", rw: "Hari ikibujijwe" },
          { en: "Something is obligatory", rw: "Hari ikitegetswe" },
          { en: "A warning only", rw: "Kuburira gusa" },
        ],
        answer: 1,
        explain: { en: "Blue circles give an order you must follow; red circles forbid.", rw: "Uruziga rw'ubururu rutanga itegeko ugomba gukurikiza; urutukura rubuza." },
      },
    ],
  },
  {
    id: "r2",
    track: "road",
    code: "R2",
    tier: "core",
    partner: { en: "Traffic Police session", rw: "Icyiciro cya Polisi y'umuhanda" },
    title: { en: "Defensive driving and the cost of one crash", rw: "Gutwara wirinda n'igiciro cy'impanuka imwe" },
    why: {
      en: "One crash can end the project: the car is off the road, the instalment still arrives, the insurance takes weeks. Defensive driving is not fear — it is protecting your income.",
      rw: "Impanuka imwe ishobora guhagarika umushinga: imodoka ihagarara, ubwishyu bugakomeza kugera, ubwishingizi bugatinda ibyumweru. Gutwara wirinda si ubwoba — ni ukurinda amafaranga winjiza.",
    },
    minutes: 60,
    delivery: "both",
    remember: [
      { en: "Three seconds behind the car in front. Four when the road is wet.", rw: "Amasegonda atatu inyuma y'imodoka iri imbere. Ane iyo umuhanda utose." },
      { en: "An EV is quiet and accelerates fast — pedestrians will not hear you coming.", rw: "Imodoka y'amashanyarazi ntigira urusaku kandi yihuta vuba — abanyamaguru ntibazakumva uje." },
    ],
    lessons: [
      {
        id: "r2l1",
        title: { en: "The three-second rule and wet roads", rw: "Amategeko y'amasegonda atatu n'imihanda itose" },
        body: [
          {
            en: "Choose a mark on the road — a pole, a sign. When the car in front passes it, count: one thousand one, one thousand two, one thousand three. If you pass the mark before three, you are too close.",
            rw: "Hitamo ikimenyetso ku muhanda — inkingi cyangwa ikibaho. Iyo imodoka iri imbere ikinyuzeho, ubare: rimwe, kabiri, gatatu. Niba ugikanyuzeho mbere ya gatatu, uri hafi cyane.",
          },
          {
            en: "In Kigali rain, add one second and reduce speed before the hill, not on it. Smooth is safe, and smooth also saves battery.",
            rw: "Mu mvura y'i Kigali, wongereho isegonda rimwe kandi ugabanye umuvuduko mbere y'umusozi, atari ku musozi. Gutwara buhoro kandi neza ni umutekano, kandi bizigama bateri.",
          },
        ],
        practice: {
          en: "Count the three seconds five times today and adjust each time you are under three.",
          rw: "Bara amasegonda atatu inshuro eshanu uyu munsi kandi wisubireho buri gihe uri munsi ya gatatu.",
        },
      },
      {
        id: "r2l2",
        title: { en: "Night, fatigue and passengers who push you", rw: "Ijoro, umunaniro, n'abagenzi bagukurikirana" },
        body: [
          {
            en: "Most serious crashes involve a tired driver at the end of a long day, or a passenger asking for speed. You own the car now — the answer is no.",
            rw: "Impanuka nyinshi zikomeye zibaho ku mushoferi wananiwe ku iherezo ry'umunsi muremure, cyangwa umugenzi usaba umuvuduko. Ubu imodoka ni iyawe — igisubizo ni oya.",
          },
          {
            en: "Fix a personal limit: a maximum number of driving hours per day, written in your plan. Rest is a business cost, like charging.",
            rw: "Shyiraho urugero rwawe bwite: umubare ntarengwa w'amasaha yo gutwara ku munsi, wanditse muri gahunda yawe. Kuruhuka ni ikiguzi cy'ubucuruzi, nko kuzuza umuriro.",
          },
        ],
        practice: {
          en: "Write your daily driving limit and the hour you stop, and tell one family member.",
          rw: "Andika amasaha ntarengwa yo gutwara ku munsi n'isaha uhagarara, ubibwire umwe mu bagize umuryango.",
        },
      },
    ],
    quiz: [
      {
        id: "r2q1",
        question: { en: "The road is wet. What following distance do you keep?", rw: "Umuhanda uratose. Ni intera ki usiga inyuma?" },
        options: [
          { en: "Two seconds", rw: "Amasegonda abiri" },
          { en: "Three seconds", rw: "Amasegonda atatu" },
          { en: "Four seconds", rw: "Amasegonda ane" },
        ],
        answer: 2,
        explain: { en: "Wet roads need at least four seconds — braking distance grows sharply.", rw: "Imihanda itose isaba nibura amasegonda ane — intera yo guhagarara yiyongera cyane." },
      },
      {
        id: "r2q2",
        question: { en: "Why is an electric car more dangerous for pedestrians at low speed?", rw: "Kuki imodoka y'amashanyarazi ishobora guteza akaga abanyamaguru ku muvuduko muke?" },
        options: [
          { en: "It is heavier", rw: "Iraremereye" },
          { en: "It is almost silent", rw: "Nta rusaku igira" },
          { en: "It cannot brake well", rw: "Ntishobora guhagarara neza" },
        ],
        answer: 1,
        explain: { en: "People cross by sound. Near markets and schools, assume they have not heard you.", rw: "Abantu bambuka bagendeye ku rusaku. Hafi y'amasoko n'amashuri, tekereza ko batakumvise." },
      },
    ],
  },
  {
    id: "r3",
    track: "road",
    code: "R3",
    tier: "core",
    title: { en: "Knowing your town: navigation and neighbourhoods", rw: "Kumenya umujyi wawe: kuyobora n'uduce" },
    why: {
      en: "A driver who knows the shortcut, the quiet drop-off point and how to follow a pin on the map earns more per hour than one who circles asking questions.",
      rw: "Umushoferi uzi inzira ngufi, aho gushyira umugenzi hatuje, n'uko akurikira ikimenyetso ku ikarita, yinjiza menshi ku isaha kurusha uzenguruka abaza.",
    },
    minutes: 90,
    delivery: "both",
    remember: [
      { en: "Always confirm the pin with the passenger before you start driving.", rw: "Buri gihe wemeze na nyir'urugendo aho pin iri mbere yo gutangira." },
      { en: "Download the offline map of your city once — it works when data is finished.", rw: "Manura ikarita y'umujyi wawe ikoresha nta interineti — ikora n'iyo amakuru ashize." },
    ],
    lessons: [
      {
        id: "r3l1",
        title: { en: "Using the map on your phone without fear", rw: "Gukoresha ikarita kuri telefone utagira ubwoba" },
        body: [
          {
            en: "Three actions only: search or open the pin the client sent, press start, and mount the phone where you can glance without turning your head.",
            rw: "Ibikorwa bitatu gusa: shakisha cyangwa ufungure pin umukiriya yohereje, ukande start, hanyuma ushyire telefone aho wayireba utahindukije umutwe.",
          },
          {
            en: "The voice speaks Kinyarwanda-friendly directions if you set the language. Listen, do not stare. If you miss a turn the map recalculates — never reverse.",
            rw: "Ijwi rivuga amabwiriza mu rurimi wahisemo. Umva, ntukareberere. Nusiba aho uhindukirira, ikarita irongera ikubarira — ntukigere usubira inyuma.",
          },
        ],
        practice: {
          en: "Set up an offline map of your city and navigate to one address you already know, just to practise.",
          rw: "Shyiraho ikarita y'umujyi wawe idakoresha interineti maze uyoborwe ugana aho usanzwe uzi, ari ukwimenyereza.",
        },
        facilitator: {
          en: "Pair a young driver with an older one. The young one teaches the phone; the older one teaches the shortcuts. Both leave taller.",
          rw: "Huza umushoferi ukiri muto n'umukuru. Umuto yigisha telefone; umukuru yigisha inzira ngufi. Bombi basohoka bishimye.",
        },
      },
      {
        id: "r3l2",
        title: { en: "The city drive-around", rw: "Kuzenguruka umujyi" },
        body: [
          {
            en: "In the practical session you drive your own town with a coach: main arteries, the hospitals, the airport route, the busy stages, and where charging exists.",
            rw: "Mu masomo ngiro utwara mu mujyi wawe uri kumwe n'umutoza: imihanda minini, ibitaro, inzira y'ikibuga cy'indege, aho abagenzi baba ari benshi, n'aho hari aho kuzuza umuriro.",
          },
          {
            en: "You end the day with your own written list of twenty landmarks and the fastest way between them at 7am and at 6pm — they are not the same.",
            rw: "Umunsi urangira ufite urutonde rwawe rw'ahantu makumyabiri hazwi n'inzira yihuta hagati yaho saa moya za mu gitondo na saa kumi n'ebyiri z'umugoroba — ntabwo ari zimwe.",
          },
        ],
        practice: {
          en: "List twenty landmarks in your town and one charging point near each cluster.",
          rw: "Andika ahantu makumyabiri hazwi mu mujyi wawe n'aho kuzuza umuriro hafi ya buri gace.",
        },
      },
    ],
    quiz: [
      {
        id: "r3q1",
        question: { en: "The map says turn but you have passed it. What is correct?", rw: "Ikarita ivuze uhindukire ariko warahanyuze. Ni iki cy'ukuri?" },
        options: [
          { en: "Reverse carefully", rw: "Subira inyuma witonze" },
          { en: "Continue and let it recalculate", rw: "Komeza uyireke yongere ikubarire" },
          { en: "Stop in the road and think", rw: "Hagarara mu muhanda utekereze" },
        ],
        answer: 1,
        explain: { en: "Reversing on a live road is one of the most common causes of city crashes.", rw: "Gusubira inyuma ku muhanda ukoreshwa ni kimwe mu byibasira cyane bitera impanuka mu mujyi." },
      },
    ],
  },
];
