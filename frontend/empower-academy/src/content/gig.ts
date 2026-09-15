import type { Module } from "./types";

/**
 * Earn-first pathway: drivers with nothing bankable yet build a verifiable
 * record by driving other people's authorised cars part-time through UZA Shift.
 */
export const gigModules: Module[] = [
  {
    id: "g1",
    track: "gig",
    code: "G1",
    tier: "core",
    title: { en: "UZA Shift: driving a car you do not own yet", rw: "UZA Shift: gutwara imodoka utaragira" },
    why: {
      en: "If no bank will finance you today, you do not wait — you drive. Car owners release their vehicle for a few hours or a few weeks; you drive it, earn per hour or per kilometre, and every trip is recorded.",
      rw: "Niba nta banki yaguha inguzanyo uyu munsi, ntutegereze — twara. Ba nyir'imodoka batanga imodoka amasaha make cyangwa ibyumweru; uyitwara, winjiza ku isaha cyangwa ku kilometero, kandi buri rugendo rwandikwa.",
    },
    minutes: 60,
    delivery: "both",
    remember: [
      { en: "The owner sets the window; you confirm pick-up address, house number and return time before you accept.", rw: "Nyir'imodoka atanga igihe; wemeza aho uyitora, numero y'inzu, n'igihe uyisubiza mbere yo kwemera." },
      { en: "Photograph the car at pick-up and at return. Every time. It protects you both.", rw: "Fata amafoto y'imodoka mu gihe uyitora n'igihe uyisubiza. Buri gihe. Birinda mwembi." },
    ],
    lessons: [
      {
        id: "g1l1",
        title: { en: "How a shift works, step by step", rw: "Uko igihe cy'akazi kigenda, intambwe ku ntambwe" },
        body: [
          {
            en: "The owner opens the app, marks the car available from 6am to 2pm, drops a pin on the house or types the house number, and states the terms: per hour, per kilometre, or a share of the fares.",
            rw: "Nyir'imodoka afungura porogaramu, yerekana ko imodoka iboneka kuva saa kumi n'ebyiri kugera saa munani, ashyira pin ku nzu cyangwa yandika numero y'inzu, kandi avuga amasezerano: ku isaha, ku kilometero, cyangwa igice cy'amafaranga y'ingendo.",
          },
          {
            en: "You accept, arrive, run the checklist with the owner, and the car switches from private to public transport mode. When your hours end it switches back automatically — the owner can also shorten or extend the window from the app.",
            rw: "Wemera, uhagera, mukoresha urutonde rw'ibigenzurwa hamwe na nyir'imodoka, hanyuma imodoka ihinduka kuva ku yigenga ikaba iy'abagenzi. Iyo amasaha yawe arangiye, isubira uko yari yasanzwe — nyir'imodoka ashobora kandi kugabanya cyangwa kongera igihe kuri porogaramu.",
          },
        ],
        practice: {
          en: "Write the four things you must confirm before accepting a shift: address, hours, pay basis, and who pays for charging.",
          rw: "Andika ibintu bine ugomba kwemeza mbere yo kwemera igihe cy'akazi: aderesi, amasaha, uburyo bwo kwishyurwa, n'uwishyura umuriro.",
        },
        facilitator: {
          en: "Role-play one handover: two drivers, one plays the owner. Include a disagreement about a scratch so the group practises the photo rule.",
          rw: "Mukine urugero rw'itangwa ry'imodoka: abashoferi babiri, umwe aba nyir'imodoka. Shyiramo ikibazo cy'urukovu ngo itsinda ryimenyereze itegeko ry'amafoto.",
        },
      },
      {
        id: "g1l2",
        title: { en: "Driving someone else's asset better than your own", rw: "Kwitwara ku mutungo w'undi kurusha uwawe" },
        body: [
          {
            en: "You return the car cleaner and better charged than you found it. That is the whole marketing strategy — owners request the same driver again, and repeat requests are what the bank later reads as employment.",
            rw: "Usubiza imodoka isukuye kandi ifite umuriro kurusha uko wayisanze. Iyo niyo ngamba yose y'ubucuruzi — ba nyir'imodoka bongera gusaba umushoferi umwe, kandi kongera kumusaba nibyo banki nyuma isoma nk'akazi gahoraho.",
          },
          {
            en: "Return rule: never hand back a car below 40% charge unless the owner agreed. Charging costs are agreed in advance, never argued afterwards.",
            rw: "Itegeko ryo kusubiza: ntukigere usubiza imodoka ifite munsi ya 40% y'umuriro keretse nyirayo yemeye. Ikiguzi cy'umuriro cyumvikanwaho mbere, ntikijya kivugurizwaho nyuma.",
          },
        ],
        practice: {
          en: "Write your own return standard — charge level, cleanliness, fuel/charge receipt — and keep it in the car.",
          rw: "Andika urugero rwawe rwo kusubiza — ijanisha ry'umuriro, isuku, inyemezabwishyu y'umuriro — ubibike mu modoka.",
        },
      },
    ],
    quiz: [
      {
        id: "g1q1",
        question: { en: "When do you photograph the car?", rw: "Amafoto y'imodoka ufata ryari?" },
        options: [
          { en: "Only if there is damage", rw: "Ari uko hari ibyangiritse" },
          { en: "At pick-up and at return, every time", rw: "Igihe uyitora n'igihe uyisubiza, buri gihe" },
          { en: "Once a month", rw: "Rimwe mu kwezi" },
        ],
        answer: 1,
        explain: { en: "Photos end arguments before they start and protect your record.", rw: "Amafoto ahagarika impaka mbere yuko zitangira kandi arinda inyandiko zawe." },
      },
    ],
  },
  {
    id: "g2",
    track: "gig",
    code: "G2",
    tier: "core",
    title: { en: "Building a record a bank cannot ignore", rw: "Kubaka inyandiko banki idashobora kwirengagiza" },
    why: {
      en: "You may have no payslip, no title deed, no guarantor. But six months of trip logs, MoMo inflows, customer ratings and a completed training certificate is a file — and a file is what gets funded.",
      rw: "Ushobora kuba udafite urupapuro rw'umushahara, nta cyemezo cy'ubutaka, nta ngwate. Ariko amezi atandatu y'ingendo zanditse, amafaranga yinjiye kuri MoMo, amanota y'abakiriya, n'impamyabumenyi y'amahugurwa ni dosiye — kandi dosiye niyo ihabwa inguzanyo.",
    },
    minutes: 60,
    delivery: "both",
    remember: [
      { en: "Four proofs: trips completed, MoMo inflow, average rating, training certificate.", rw: "Ibimenyetso bine: ingendo zarangiye, amafaranga yinjiye kuri MoMo, impuzandengo y'amanota, impamyabumenyi y'amahugurwa." },
      { en: "Keep business money on one line. Mixed accounts hide your own success from you and from the bank.", rw: "Bika amafaranga y'ubucuruzi mu nzira imwe. Konti zivanze zihisha intsinzi yawe kuri wowe no kuri banki." },
    ],
    lessons: [
      {
        id: "g2l1",
        title: { en: "The six-month file", rw: "Dosiye y'amezi atandatu" },
        body: [
          {
            en: "Month by month you accumulate: hours driven, kilometres, gross earnings, what you kept, your rating, and any incident. UZA prints this as one page the loan officer can read in two minutes.",
            rw: "Ukwezi ku kwezi wegeranya: amasaha watwaye, kilometero, amafaranga yose yinjiye, ibyo wabitse, amanota yawe, n'ibyabaye bidasanzwe. UZA ibicapa nk'urupapuro rumwe ushinzwe inguzanyo asoma mu minota ibiri.",
          },
          {
            en: "Consistency beats size. A driver earning modestly every single week is a better risk than one with two big months and four empty ones.",
            rw: "Guhorana biruta ubwinshi. Umushoferi winjiza bike buri cyumweru arushaho kwizerwa kurusha ufite amezi abiri manini n'ane atagira kimwe.",
          },
        ],
        practice: {
          en: "Record your first week in the daily log: hours, kilometres, earnings, one note.",
          rw: "Andika icyumweru cyawe cya mbere mu gitabo cya buri munsi: amasaha, kilometero, amafaranga, inyandiko imwe.",
        },
      },
      {
        id: "g2l2",
        title: { en: "From shift driver to owner", rw: "Kuva ku mushoferi w'igihe ukagera ku nyir'imodoka" },
        body: [
          {
            en: "The pathway is written down: three months clean conduct, six months of records, core certificate, then UZA presents you to the bank with the file and the training history behind you.",
            rw: "Inzira yanditse: amezi atatu y'imyitwarire nziza, amezi atandatu y'inyandiko, impamyabumenyi y'ibanze, hanyuma UZA ikwerekana kuri banki ifite dosiye n'amateka y'amahugurwa inyuma yawe.",
          },
          {
            en: "Young drivers, women and first-time earners get priority support in this pathway: mentorship, a lower entry deposit target, and placement with owners who prefer a trained driver.",
            rw: "Abashoferi bakiri bato, abagore, n'abatangira gukora bahabwa ubufasha bwihariye muri iyi nzira: ubujyanama, urugero ruto rwo kwitangira, no guhuzwa na ba nyir'imodoka bakunda umushoferi wahuguwe.",
          },
        ],
        practice: {
          en: "Write today's date and the date six months from now. That is your file window — start it.",
          rw: "Andika itariki y'uyu munsi n'iy'amezi atandatu ari imbere. Icyo ni igihe cya dosiye yawe — tangira.",
        },
      },
    ],
    quiz: [
      {
        id: "g2q1",
        question: { en: "Which record is worth most to a lender?", rw: "Ni iyihe nyandiko ifite agaciro kanini ku utanga inguzanyo?" },
        options: [
          { en: "Two very big months", rw: "Amezi abiri manini cyane" },
          { en: "Six steady months with ratings and certificate", rw: "Amezi atandatu ahoraho, hamwe n'amanota n'impamyabumenyi" },
          { en: "A verbal promise from a customer", rw: "Isezerano ry'akanwa rya umukiriya" },
        ],
        answer: 1,
        explain: { en: "Lenders price risk on consistency and verifiability, not on peaks.", rw: "Abatanga inguzanyo bapima ingaruka bashingiye ku guhorana no ku bishobora kugenzurwa, atari ku byatumbagiye rimwe." },
      },
    ],
  },
];
