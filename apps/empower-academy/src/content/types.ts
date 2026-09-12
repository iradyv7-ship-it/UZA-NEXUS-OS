export type Lang = "en" | "rw";

/** Every learner-facing string is a pair. Kinyarwanda is editable in place. */
export type T = { en: string; rw: string };

export type Lesson = {
  id: string;
  title: T;
  /** Short teaching paragraphs. Keep sentences short — read aloud in class. */
  body: T[];
  /** One concrete thing the driver does today. */
  practice: T;
  /** Optional facilitator-only note (classroom mode). */
  facilitator?: T;
};

export type QuizItem = {
  id: string;
  question: T;
  options: T[];
  answer: number;
  explain: T;
};

export type Module = {
  id: string;
  track: TrackId;
  code: string;
  title: T;
  /** Why this matters, in the driver's own world. */
  why: T;
  minutes: number;
  delivery: "phone" | "classroom" | "both";
  /**
   * core = required for the certificate of participation.
   * advanced = paid specialist training taken after the core programme.
   */
  tier?: "core" | "advanced";
  /** Who normally leads the session in the classroom (bank, police, garage…). */
  partner?: T;
  lessons: Lesson[];
  quiz: QuizItem[];
  /** Numbers or rules worth memorising. */
  remember: T[];
};

export type TrackId = "money" | "vehicle" | "road" | "conduct" | "gig" | "tech";

export type GlossaryEntry = { term: T; meaning: T };
