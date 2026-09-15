import type { Module } from "./types";

/**
 * VoltCare by UZA Mobility — the garage and maintenance arm. T1/T2 are free
 * owner training led by garage staff. T3+ are paid specialist modules for
 * technicians in the ecosystem.
 */
export const techModules: Module[] = [
  {
    id: "t1",
    track: "tech",
    code: "T1",
    tier: "core",
    partner: { en: "VoltCare garage session", rw: "Icyiciro cya garage VoltCare" },
    title: { en: "Owning an EV: the garage explains your car", rw: "Kugira imodoka y'amashanyarazi: garage isobanura imodoka yawe" },
    why: {
      en: "There is no engine oil, no gearbox, no clutch, no spark plug. Half of what you learned to worry about is gone — and three new things replace it: the battery, the tyres, and the brakes you barely use.",
      rw: "Nta mavuta ya moteri, nta bwoko bwa vitesi, nta clutch, nta bougie. Kimwe cya kabiri cy'ibyo wari umenyereye kwitaho birazimiye — ibintu bitatu bishya birabisimbura: bateri, amapine, n'amaferi udakoresha cyane.",
    },
    minutes: 90,
    delivery: "both",
    remember: [
      { en: "Daily: tyres and charge. Weekly: brake feel, coolant level, tyre pressure. Monthly: cabin filter, wheel alignment check.", rw: "Buri munsi: amapine n'umuriro. Buri cyumweru: uko amaferi yumvikana, urugero rw'amazi akonjesha, umwuka mu mapine. Buri kwezi: filtre y'imbere, kugenzura ihuza ry'amapine." },
      { en: "A tyre at wrong pressure costs you range every single day — it is the cheapest money you will ever save.", rw: "Ipine ridafite umwuka uhagije rikwaka urugendo buri munsi — ni amafaranga yoroshye cyane wazigama." },
    ],
    lessons: [
      {
        id: "t1l1",
        title: { en: "What replaced the service you knew", rw: "Ibyasimbuye isuzuma wari umenyereye" },
        body: [
          {
            en: "On your old Avensis, service meant oil, filters, belts and a clutch that wore out. On the EV, the drivetrain has one moving part where you had hundreds. Scheduled service is mostly inspection, software and tyres.",
            rw: "Kuri Avensis yawe ya kera, isuzuma ryasobanuraga amavuta, filtre, imikandara, na clutch yashiraga. Ku modoka y'amashanyarazi, igice gitwara imodoka gifite igice kimwe kigenda aho hari amagana. Isuzuma risanzwe ni ugenzura, porogaramu, n'amapine.",
          },
          {
            en: "Regenerative braking means your brake pads can last three times longer — but the discs can rust from disuse. Once a week, brake firmly from moderate speed on an empty road to clean them.",
            rw: "Amaferi asubiza ingufu bituma pads z'amaferi zimara igihe kirekire inshuro eshatu — ariko disiki zishobora kurwara ingese kubera kudakoreshwa. Rimwe mu cyumweru, kanda amaferi ukomeye uva ku muvuduko uringaniye ku muhanda utagira abandi ngo uzisukure.",
          },
        ],
        practice: {
          en: "Check all four tyre pressures today and write the correct figures from the door sticker in your log.",
          rw: "Genzura umwuka mu mapine yose ane uyu munsi kandi wandike imibare nyayo iri ku kimenyetso ku rugi mu gitabo cyawe.",
        },
        facilitator: {
          en: "Do this session inside the workshop with a car on the lift. Let every driver touch the parts named.",
          rw: "Iri somo rikorwe muri garage imodoka iri ku gikoresho ciyizamura. Reka buri mushoferi akore ku bice bivuzwe.",
        },
      },
      {
        id: "t1l2",
        title: { en: "Charging without damaging the battery", rw: "Kuzuza umuriro utangiza bateri" },
        body: [
          {
            en: "Daily rule: keep the battery between 20% and 80%. Charge to 100% only before a long trip, and drive soon after — a full battery does not like sitting full in the sun.",
            rw: "Itegeko rya buri munsi: gumya bateri hagati ya 20% na 80%. Uzuza kugera kuri 100% gusa mbere y'urugendo rurerure, kandi ugende vuba nyuma yaho — bateri yuzuye ntikunda kuguma yuzuye mu zuba.",
          },
          {
            en: "Slow (AC) charging overnight is the healthiest. Fast (DC) charging is for the middle of a working day — use it when you must, not as your habit. Never leave the car at 0–5% overnight.",
            rw: "Kuzuza buhoro (AC) nijoro nibyo byiza kuri bateri. Kuzuza vuba (DC) ni ku manywa y'akazi — bikoreshe iyo bibaye ngombwa, atari akamenyero. Ntukigere usiga imodoka kuri 0–5% ijoro ryose.",
          },
        ],
        practice: {
          en: "Set a phone alarm at the hour you normally plug in, and write your target: stop at 80%.",
          rw: "Shyira urwibutso kuri telefone ku isaha usanzwe uhuza imodoka n'umuriro, kandi wandike intego: hagarara kuri 80%.",
        },
      },
    ],
    quiz: [
      {
        id: "t1q1",
        question: { en: "What is the healthy daily charge window?", rw: "Ni irihe janisha ryiza rya buri munsi?" },
        options: [
          { en: "0% to 100%", rw: "0% kugera 100%" },
          { en: "20% to 80%", rw: "20% kugera 80%" },
          { en: "50% to 100%", rw: "50% kugera 100%" },
        ],
        answer: 1,
        explain: { en: "Keeping between 20% and 80% preserves battery life for years.", rw: "Kuguma hagati ya 20% na 80% birinda ubuzima bwa bateri imyaka myinshi." },
      },
      {
        id: "t1q2",
        question: { en: "Why brake firmly once a week?", rw: "Kuki ukanda amaferi ukomeye rimwe mu cyumweru?" },
        options: [
          { en: "To test the motor", rw: "Kugerageza moteri" },
          { en: "To clean rust off discs you rarely use", rw: "Kuvana ingese ku disiki udakoresha cyane" },
          { en: "To recharge the battery faster", rw: "Kuzuza bateri vuba" },
        ],
        answer: 1,
        explain: { en: "Regenerative braking means the friction brakes sit unused and can corrode.", rw: "Amaferi asubiza ingufu bituma amaferi asanzwe adakoreshwa bishobora kubatera ingese." },
      },
    ],
  },
  {
    id: "t2",
    track: "tech",
    code: "T2",
    tier: "advanced",
    partner: { en: "VoltCare technician track (paid)", rw: "Icyiciro cy'abatekinisiye VoltCare (kishyurwa)" },
    title: { en: "For technicians: high-voltage safety and isolation", rw: "Ku batekinisiye: umutekano w'amashanyarazi menshi no kubitandukanya" },
    why: {
      en: "Rwanda's mechanics learned petrol and diesel. An EV pack carries hundreds of volts of direct current — the same skill of hands, a completely new discipline of procedure.",
      rw: "Abakanishi bo mu Rwanda bize lisansi na mazutu. Bateri y'imodoka y'amashanyarazi ifite amavolti amagana ya courant continue — ubuhanga bumwe bw'amaboko, ariko uburyo bushya rwose bwo gukurikiza amabwiriza.",
    },
    minutes: 180,
    delivery: "classroom",
    remember: [
      { en: "Never open a pack without insulated gloves, a rated multimeter and a second qualified person present.", rw: "Ntukigere ufungura bateri udafite uduhindira twirinda amashanyarazi, multimeter ibigenewe, n'undi muntu wabyize uhari." },
      { en: "Isolate, verify zero volts, then wait the manufacturer's discharge time. Verification is not optional.", rw: "Tandukanya, ugenzure ko nta mavolti ahari, hanyuma utegereze igihe uwakoze imodoka yavuze. Kugenzura si ihitamo." },
    ],
    lessons: [
      {
        id: "t2l1",
        title: { en: "The isolation procedure", rw: "Uburyo bwo gutandukanya amashanyarazi" },
        body: [
          {
            en: "Park, power off, remove the service plug, lock out and tag out, then measure. Orange cabling is always high voltage — it is never cut, spliced or repaired informally.",
            rw: "Pariki, uzimye, ukure service plug, ushyireho ikimenyetso n'ingufuli, hanyuma upime. Insinga z'ibara ry'orange buri gihe ni z'amashanyarazi menshi — ntizigera zicibwa, zihuzwa, cyangwa zisanwa uko byaza.",
          },
          {
            en: "Every intervention is written: vehicle, pack state of health, fault codes read, action taken, technician name. This log is what makes a workshop certifiable — and insurable.",
            rw: "Buri gikorwa cyandikwa: imodoka, ubuzima bwa bateri, kode z'ikibazo zasomwe, igikorwa cyakozwe, izina ry'umutekinisiye. Iyi nyandiko ituma garage yemerwa — kandi ishoborwa kwishingirwa.",
          },
        ],
        practice: {
          en: "Write the five isolation steps from memory and have your trainer check them.",
          rw: "Andika intambwe eshanu zo gutandukanya nta kwitegereza kandi ureke umutoza azigenzure.",
        },
      },
      {
        id: "t2l2",
        title: { en: "Diagnostics: reading the car instead of guessing", rw: "Isuzuma: gusoma imodoka aho kukeka" },
        body: [
          {
            en: "Connect the diagnostic tool, read the fault codes, look at cell voltage spread and thermal data. A 0.2V spread across cells tells you more than any noise ever did.",
            rw: "Huza igikoresho cy'isuzuma, usome kode z'ikibazo, urebe itandukaniro ry'amavolti ku turemangingo n'amakuru y'ubushyuhe. Itandukaniro rya 0.2V hagati y'uturemangingo rikubwira byinshi kurusha urusaku rwose.",
          },
          {
            en: "Advanced modules that follow cover battery thermal management, inverter faults, software updates, and the economics of pack repair versus replacement.",
            rw: "Amasomo ahanitse akurikira asobanura kugenzura ubushyuhe bwa bateri, ibibazo by'inverter, kuvugurura porogaramu, n'ubukungu bwo kusana bateri cyangwa kuyisimbuza.",
          },
        ],
        practice: {
          en: "Pull one full diagnostic report and explain three lines of it to another technician.",
          rw: "Kura raporo yuzuye y'isuzuma maze usobanure imirongo itatu yayo ku wundi mutekinisiye.",
        },
      },
    ],
    quiz: [
      {
        id: "t2q1",
        question: { en: "Orange cabling in an EV means…", rw: "Insinga z'orange mu modoka y'amashanyarazi zisobanura…" },
        options: [
          { en: "Low-voltage accessory wiring", rw: "Insinga z'ibikoresho bito" },
          { en: "High voltage — never touch without isolation", rw: "Amashanyarazi menshi — ntukorekore utabanje kubitandukanya" },
          { en: "Ground wiring", rw: "Insinga z'ubutaka" },
        ],
        answer: 1,
        explain: { en: "Orange is the international marking for high-voltage DC circuits.", rw: "Ibara ry'orange ni ikimenyetso mpuzamahanga cy'amashanyarazi menshi ya DC." },
      },
    ],
  },
];
