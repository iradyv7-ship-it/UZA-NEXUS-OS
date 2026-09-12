import type { Module } from "./types";

/**
 * Conduct, discipline and bankability. The bank leads C2; the code of conduct
 * in C1 is what makes an UZA-coached driver recognisable from the outside.
 */
export const conductModules: Module[] = [
  {
    id: "c1",
    track: "conduct",
    code: "C1",
    tier: "core",
    title: { en: "The UZA code of conduct", rw: "Amahame y'imyitwarire ya UZA" },
    why: {
      en: "Anyone can buy a car. What cannot be bought is a driver a customer trusts with their child, their mother, their luggage. That reputation is the asset that outlives the loan.",
      rw: "Umuntu wese ashobora kugura imodoka. Ikidashobora kugurwa ni umushoferi umukiriya yizera akamwizeza umwana we, nyina, cyangwa ibintu bye. Iyo isura nziza ni umutungo urenga inguzanyo.",
    },
    minutes: 60,
    delivery: "both",
    remember: [
      { en: "Ten rules, signed by you, in front of your group. A signed promise is stronger than a private one.", rw: "Amategeko icumi, ushyizeho umukono, imbere y'itsinda ryawe. Isezerano ryanditse rirakomeye kurusha iryo mu mutima gusa." },
      { en: "No alcohol, no phone in the hand, no bargaining after the trip, no leaving a passenger stranded.", rw: "Nta nzoga, nta telefone mu ntoki, nta kuvuguruzanya nyuma y'urugendo, nta kureka umugenzi mu nzira." },
    ],
    lessons: [
      {
        id: "c1l1",
        title: { en: "The ten rules", rw: "Amategeko icumi" },
        body: [
          {
            en: "Arrive on time or call early. Keep the car clean inside and out. Agree the price or use the meter before moving. Never drive after drinking. Never touch the phone in your hand while driving.",
            rw: "Ba ku gihe cyangwa uhamagare hakiri kare. Gumya imodoka isukuye imbere n'inyuma. Mwumvikane ku giciro cyangwa ukoreshe metero mbere yo kugenda. Ntukigere utwara umaze kunywa. Ntukigere ufata telefone mu ntoki utwara.",
          },
          {
            en: "Help with luggage. Respect women, elders, children and people with disability. Do not discuss politics or religion with a passenger. Return anything left in the car. Report every incident to your cohort facilitator the same day.",
            rw: "Fasha ku bijyanye n'imizigo. Ubahe abagore, abasaza, abana, n'abafite ubumuga. Ntuganire politiki cyangwa idini n'umugenzi. Subiza ibyasigaye mu modoka. Menyesha umutoza w'itsinda ryawe ikintu cyose cyabaye kuri uwo munsi.",
          },
        ],
        practice: {
          en: "Read the ten rules out loud and sign the code in your workbook.",
          rw: "Soma amategeko icumi mu ijwi riranguruye maze ushyire umukono ku mahame mu gitabo cyawe.",
        },
        facilitator: {
          en: "Sign in public, one by one, with applause. This is a ceremony, not paperwork — it is what the group will hold each other to later.",
          rw: "Bashyire umukono imbere y'abandi, umwe umwe, hamwe n'amashyi. Ni umuhango, ntabwo ni impapuro — nibyo itsinda rizakomeza kwibutsanya.",
        },
      },
      {
        id: "c1l2",
        title: { en: "Reviews: your public record", rw: "Ibitekerezo by'abakiriya: inyandiko igaragara" },
        body: [
          {
            en: "Ask every satisfied passenger for a review or a star rating. Five reviews a week becomes two hundred a year: proof of work no interview can give.",
            rw: "Saba buri mugenzi wanyuzwe atange igitekerezo cyangwa amanota. Ibitekerezo bitanu ku cyumweru bihinduka magana abiri ku mwaka: ikimenyetso cy'akazi nta kiganiro cy'akazi gitanga.",
          },
          {
            en: "A bad review is information, not an insult. Read it, fix the one thing it names, and say thank you.",
            rw: "Igitekerezo kibi ni amakuru, ntabwo ari igitutsi. Gisome, ukosore ikintu kimwe kivuga, hanyuma ushimire.",
          },
        ],
        practice: {
          en: "Ask your next three passengers for a review. Write down how many said yes.",
          rw: "Saba abagenzi batatu bakurikira igitekerezo. Andika bangahe bemeye.",
        },
      },
    ],
    quiz: [
      {
        id: "c1q1",
        question: { en: "A passenger leaves a phone in your car. What do you do?", rw: "Umugenzi asize telefone mu modoka yawe. Ukora iki?" },
        options: [
          { en: "Wait until they call", rw: "Utegereza kugeza abahamagaye" },
          { en: "Contact them and report it to your facilitator the same day", rw: "Umuhamagare kandi umenyeshe umutoza kuri uwo munsi" },
          { en: "Keep it safe and say nothing", rw: "Uyibike utavuze" },
        ],
        answer: 1,
        explain: { en: "Speed and transparency are what build the reputation of the whole cohort.", rw: "Kwihuta no kugaragaza ukuri nibyo byubaka isura y'itsinda ryose." },
      },
    ],
  },
  {
    id: "c2",
    track: "conduct",
    code: "C2",
    tier: "core",
    partner: { en: "Bank session (loan officer)", rw: "Icyiciro cya banki (ushinzwe inguzanyo)" },
    title: { en: "Becoming bankable: on-time repayment and what goes in your record", rw: "Kuba uwizewe na banki: kwishyura ku gihe n'ibyandikwa mu nyandiko zawe" },
    why: {
      en: "The first loan is the small one. The second loan — a second car, a bigger one, a lower rate — is decided entirely by how you handled the first. That decision is written month by month.",
      rw: "Inguzanyo ya mbere ni nto. Iya kabiri — imodoka ya kabiri, inini, ifite inyungu nke — iterwa gusa n'uko witwaye kuri ya mbere. Icyo cyemezo cyandikwa ukwezi ku kwezi.",
    },
    minutes: 90,
    delivery: "classroom",
    remember: [
      { en: "Pay before the due date, not on it. One day late can be recorded.", rw: "Ishyura mbere y'itariki ntarengwa, atari kuri yo. Umunsi umwe wo gutinda ushobora kwandikwa." },
      { en: "If you will be short, call the bank BEFORE the date. Silence is what destroys trust, not the shortage.", rw: "Niba uzabura amafaranga, hamagara banki MBERE y'itariki. Iceceka nicyo cyangiza ikizere, ntabwo ari ukubura." },
      { en: "Twelve on-time instalments is an asset. Protect it like you protect the car.", rw: "Ubwishyu cumi na bibiri bwishyuwe ku gihe ni umutungo. Burinde nk'uko urinda imodoka." },
    ],
    lessons: [
      {
        id: "c2l1",
        title: { en: "What the bank actually looks at", rw: "Ibyo banki ireba mu by'ukuri" },
        body: [
          {
            en: "The loan officer opens three things: your repayment history, the money moving through your MoMo or bank account, and whether your declared income matches what really arrives.",
            rw: "Ushinzwe inguzanyo areba ibintu bitatu: amateka yawe yo kwishyura, amafaranga anyura kuri MoMo cyangwa kuri konti yawe, no kureba ko amafaranga wavuze ahura n'ayinjira mu by'ukuri.",
          },
          {
            en: "This session is where you ask the bank everything: the interest, the penalty, the insurance, what happens if the car is off the road for a week, and what makes them say yes next time.",
            rw: "Iri somo ni aho ubaza banki byose: inyungu, ihazabu, ubwishingizi, ibiba iyo imodoka imaze icyumweru idakora, n'ibituma bemera ubutaha.",
          },
        ],
        practice: {
          en: "Write three questions for the loan officer before the session starts, and ask them.",
          rw: "Andika ibibazo bitatu ubaza ushinzwe inguzanyo mbere y'itangira ry'icyiciro, hanyuma ubibaze.",
        },
        facilitator: {
          en: "Ask the bank to present the product in plain Kinyarwanda with a printed repayment table, and to state clearly what a consistent repayment record earns the driver next time.",
          rw: "Saba banki gusobanura umusaruro mu Kinyarwanda gisanzwe hamwe n'imbonerahamwe y'ubwishyu icapishijwe, kandi bavuge neza icyo inyandiko nziza yo kwishyura buri gihe imarira umushoferi ubutaha.",
        },
      },
      {
        id: "c2l2",
        title: { en: "Your default-prevention plan", rw: "Gahunda yo kwirinda kutishyura" },
        body: [
          {
            en: "Every driver writes one before the loan starts. It has four lines: my instalment amount, my buffer envelope (one instalment kept aside), my early-warning day (the day I check if the buffer is enough), and who I call if it is not.",
            rw: "Buri mushoferi ayandika mbere yuko inguzanyo itangira. Ifite imirongo ine: ingano y'ubwishyu, ibahasha y'ubwiteganyirize (ubwishyu bumwe bubitswe), umunsi wo kwiburira (umunsi ngenzura ko ubwiteganyirize buhagije), n'uwo mpamagara nibitabaye ngombwa.",
          },
          {
            en: "Sickness, a broken part, a slow month — these are normal. A plan turns them into a phone call instead of a repossession.",
            rw: "Uburwayi, igice cyangiritse, ukwezi kuke — ibi bisanzwe. Gahunda ibihindura guhamagara aho kuba kwamburwa imodoka.",
          },
        ],
        practice: {
          en: "Fill your four lines and put your early-warning day in your phone as a monthly reminder.",
          rw: "Uzuza imirongo yawe ine kandi ushyire umunsi wo kwiburira kuri telefone yawe nk'urwibutso rwa buri kwezi.",
        },
      },
    ],
    quiz: [
      {
        id: "c2q1",
        question: { en: "You know now that next month's instalment will be short. When do you contact the bank?", rw: "Uzi ubu ko ubwishyu bw'ukwezi gutaha buzaba budahagije. Uhamagara banki ryari?" },
        options: [
          { en: "After the due date", rw: "Nyuma y'itariki ntarengwa" },
          { en: "Immediately, before the due date", rw: "Ako kanya, mbere y'itariki ntarengwa" },
          { en: "Only if they call you", rw: "Ari uko bakuhamagaye" },
        ],
        answer: 1,
        explain: { en: "Early contact usually gets a restructure. Late contact gets a penalty and a mark on your record.", rw: "Kuvugana hakiri kare bikunda kuzana ivugururwa ry'ubwishyu. Gutinda bizana ihazabu n'ikimenyetso kibi mu nyandiko zawe." },
      },
      {
        id: "c2q2",
        question: { en: "Which of these strengthens your file most for a second loan?", rw: "Ni ikihe muri ibi gikomeza dosiye yawe cyane ku nguzanyo ya kabiri?" },
        options: [
          { en: "A big single deposit", rw: "Amafaranga menshi wabitse rimwe" },
          { en: "Twelve months of on-time payments and steady MoMo inflows", rw: "Amezi cumi n'abiri wishyuye ku gihe n'amafaranga ahoraho anyura kuri MoMo" },
          { en: "Knowing someone at the branch", rw: "Kumenya umuntu ku ishami" },
        ],
        answer: 1,
        explain: { en: "Consistency is the signal. It is the cheapest thing you own and the most valuable.", rw: "Guhorana ni ikimenyetso. Ni ikintu gito ufite ariko gifite agaciro gakomeye." },
      },
    ],
  },
];
