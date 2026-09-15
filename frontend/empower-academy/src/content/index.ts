import { moneyModules } from "./money";
import { vehicleModules } from "./vehicle";
import { roadModules } from "./road";
import { conductModules } from "./conduct";
import { gigModules } from "./gig";
import { techModules } from "./tech";
import type { GlossaryEntry, Module, T } from "./types";

export * from "./types";

export const curriculum: Module[] = [
  ...moneyModules,
  ...vehicleModules,
  ...roadModules,
  ...conductModules,
  ...gigModules,
  ...techModules,
];

/** Modules required for the UZA certificate of participation. */
export const coreCurriculum: Module[] = curriculum.filter((m) => m.tier !== "advanced");

/** Paid specialist modules for technicians in the ecosystem. */
export const advancedCurriculum: Module[] = curriculum.filter((m) => m.tier === "advanced");

export const tracks: { id: Module["track"]; title: T; blurb: T }[] = [
  {
    id: "money",
    title: { en: "Money & business", rw: "Amafaranga n'ubucuruzi" },
    blurb: {
      en: "Recording, wallet envelopes, the loan, and a one-page business plan.",
      rw: "Kwandika, amabahasha y'ikofi, inguzanyo, na gahunda y'ubucuruzi ku rupapuro rumwe.",
    },
  },
  {
    id: "vehicle",
    title: { en: "The electric car", rw: "Imodoka y'amashanyarazi" },
    blurb: {
      en: "From an old manual sedan to a new automatic EV: charging, checks, range, safety.",
      rw: "Kuva ku modoka ishaje ya vitesi ukagera ku modoka nshya y'amashanyarazi: kuzuza umuriro, isuzuma, urugendo, umutekano.",
    },
  },
  {
    id: "road",
    title: { en: "Road craft", rw: "Ubuhanga bwo ku muhanda" },
    blurb: {
      en: "With the traffic police: signs, priority, defensive driving, and knowing your town with the map.",
      rw: "Hamwe na Polisi y'umuhanda: ibimenyetso, ubanza, gutwara wirinda, no kumenya umujyi wawe ukoresha ikarita.",
    },
  },
  {
    id: "conduct",
    title: { en: "Conduct & bankability", rw: "Imyitwarire n'ikizere cya banki" },
    blurb: {
      en: "The UZA code of conduct, customer reviews, and a bank-led session on repaying on time and never defaulting.",
      rw: "Amahame y'imyitwarire ya UZA, ibitekerezo by'abakiriya, n'icyiciro kiyobowe na banki ku kwishyura ku gihe no kudatsindwa n'umwenda.",
    },
  },
  {
    id: "gig",
    title: { en: "Earn first: UZA Shift", rw: "Banza winjize: UZA Shift" },
    blurb: {
      en: "No collateral yet? Drive authorised private cars part-time, and build the record that earns you the loan.",
      rw: "Nta ngwate ufite? Twara imodoka zigenga zemewe igihe runaka, wubake inyandiko izatuma uhabwa inguzanyo.",
    },
  },
  {
    id: "tech",
    title: { en: "VoltCare workshop", rw: "Garage VoltCare" },
    blurb: {
      en: "Garage-led EV ownership training, plus paid specialist modules for technicians who service electric vehicles.",
      rw: "Amahugurwa ku kugira imodoka y'amashanyarazi ayobowe na garage, n'amasomo yihariye yishyurwa ku batekinisiye basana imodoka z'amashanyarazi.",
    },
  },
];

export function moduleById(id: string): Module | undefined {
  return curriculum.find((m) => m.id === id);
}

export const totalMinutes = curriculum.reduce((sum, m) => sum + m.minutes, 0);
export const coreMinutes = coreCurriculum.reduce((sum, m) => sum + m.minutes, 0);

export const glossary: GlossaryEntry[] = [
  { term: { en: "Income", rw: "Amafaranga yinjiye" }, meaning: { en: "Everything customers paid you.", rw: "Ibyo abakiriya bakwishyuye byose." } },
  { term: { en: "Profit", rw: "Inyungu" }, meaning: { en: "What remains after costs and the instalment.", rw: "Ibisigara ibiciro n'ubwishyu bimaze gukurwamo." } },
  { term: { en: "Instalment", rw: "Ubwishyu bw'igihe" }, meaning: { en: "The fixed amount you pay the bank each period.", rw: "Amafaranga ahoraho wishyura banki kuri buri gihe." } },
  { term: { en: "Reducing balance", rw: "Umwenda ugabanuka" }, meaning: { en: "Interest is charged on what you still owe.", rw: "Inyungu ibarwa ku byo ukirimo." } },
  { term: { en: "kWh", rw: "kWh" }, meaning: { en: "The unit of electricity you buy — like a litre of fuel.", rw: "Igipimo cy'amashanyarazi ugura — nka litiro ya lisansi." } },
  { term: { en: "Regenerative braking", rw: "Amaferi asubiza ingufu" }, meaning: { en: "Slowing down puts energy back into the battery.", rw: "Kugabanya umuvuduko bisubiza ingufu muri bateri." } },
  { term: { en: "State of charge (%)", rw: "Ijanisha ry'umuriro" }, meaning: { en: "How full the battery is right now.", rw: "Uko bateri yuzuye ubu." } },
  { term: { en: "Priority", rw: "Ubanza kugenda" }, meaning: { en: "Who is allowed to go first at a junction — given, not taken.", rw: "Uwemerewe kubanza ku isangano — butangwa, ntibwifatirwa." },
  },
  { term: { en: "Bankable", rw: "Uwizewe na banki" }, meaning: { en: "Your records prove you can repay, so a lender says yes.", rw: "Inyandiko zawe zigaragaza ko ushobora kwishyura, banki ikemera." } },
  { term: { en: "Shift", rw: "Igihe cy'akazi" }, meaning: { en: "A block of hours in which you drive someone else's authorised car.", rw: "Igihe runaka utwara imodoka y'undi yemewe." } },
  { term: { en: "Isolation (HV)", rw: "Gutandukanya amashanyarazi" }, meaning: { en: "Making a high-voltage system safe before any technician touches it.", rw: "Gutuma sisitemu y'amashanyarazi menshi igira umutekano mbere yuko umutekinisiye ayikoraho." } },
];
