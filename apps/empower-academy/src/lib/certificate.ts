import QRCode from "qrcode";

export type CertificateData = {
  name: string;
  cohort: string | null;
  issuedOn: Date;
  moduleCount: number;
  finalScore: number | null;
  certificateId: string;
  verifyUrl: string;
  lang: "en" | "rw";
};

const INK = "#12241d";
const PAPER = "#fbfdf7";
const VOLT = "#cbf24a";
const MUTED = "#5c6b62";

const COPY = {
  en: {
    org: "URUGENDO RW'UBUKUNGU · UZA EMPOWER",
    kicker: "Certificate of completion",
    intro: "This certifies that",
    body: (n: number, score: number | null) =>
      score == null
        ? `has completed all ${n} required modules of the UZA Empower driver programme in financial literacy and electric vehicles.`
        : `has completed all ${n} required modules of the UZA Empower driver programme in financial literacy and electric vehicles, and passed the final assessment with ${score}%.`,
    cohort: "Cohort",
    date: "Issued on",
    serial: "Certificate ID",
    sign: "Programme facilitator",
    verify: "Verify at",
  },
  rw: {
    org: "URUGENDO RW'UBUKUNGU · UZA EMPOWER",
    kicker: "Impamyabumenyi yo kurangiza",
    intro: "Iyi impamyabumenyi yemeza ko",
    body: (n: number, score: number | null) =>
      score == null
        ? `yarangije amasomo yose ${n} asabwa muri gahunda ya UZA Empower ku bumenyi bw'imari no ku modoka z'amashanyarazi.`
        : `yarangije amasomo yose ${n} asabwa muri gahunda ya UZA Empower ku bumenyi bw'imari no ku modoka z'amashanyarazi, kandi yatsinze ikizamini cya nyuma ku ${score}%.`,
    cohort: "Itsinda",
    date: "Yatanzwe ku",
    serial: "Nomero y'impamyabumenyi",
    sign: "Umutoza wa gahunda",
    verify: "Genzura kuri",
  },
} as const;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws the certificate at 2000x1414 (A4 landscape) and returns the canvas. */
export async function drawCertificate(data: CertificateData): Promise<HTMLCanvasElement> {
  const W = 2000;
  const H = 1414;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const c = COPY[data.lang];

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.strokeRect(60, 60, W - 120, H - 120);
  ctx.strokeStyle = VOLT;
  ctx.lineWidth = 14;
  ctx.strokeRect(92, 92, W - 184, H - 184);

  ctx.fillStyle = INK;
  ctx.fillRect(60, 60, 220, 18);
  ctx.fillRect(W - 280, H - 78, 220, 18);

  const cx = W / 2;
  ctx.textAlign = "center";

  ctx.fillStyle = INK;
  ctx.font = "700 32px 'Space Grotesk', sans-serif";
  ctx.fillText(c.org, cx, 240);

  ctx.fillStyle = MUTED;
  ctx.font = "500 30px 'DM Sans', sans-serif";
  ctx.fillText(c.kicker.toUpperCase(), cx, 300);

  ctx.fillStyle = VOLT;
  ctx.fillRect(cx - 70, 340, 140, 10);

  ctx.fillStyle = MUTED;
  ctx.font = "400 34px 'DM Sans', sans-serif";
  ctx.fillText(c.intro, cx, 440);

  ctx.fillStyle = INK;
  const nameSize = data.name.length > 26 ? 88 : 116;
  ctx.font = `700 ${nameSize}px 'Space Grotesk', sans-serif`;
  ctx.fillText(data.name, cx, 580);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 520, 630);
  ctx.lineTo(cx + 520, 630);
  ctx.stroke();

  ctx.fillStyle = INK;
  ctx.font = "400 36px 'DM Sans', sans-serif";
  const lines = wrap(ctx, c.body(data.moduleCount, data.finalScore), W - 700);
  lines.forEach((line, i) => ctx.fillText(line, cx, 710 + i * 52));

  const baseY = 1040;
  const cols: [string, string][] = [
    [c.cohort, data.cohort ?? "—"],
    [
      c.date,
      data.issuedOn.toLocaleDateString(data.lang === "rw" ? "en-GB" : "en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    ],
    [c.serial, data.certificateId],
  ];
  const colW = (W - 700) / 3;
  cols.forEach(([label, value], i) => {
    const x = 300 + colW * i + colW / 2;
    ctx.fillStyle = MUTED;
    ctx.font = "500 24px 'DM Sans', sans-serif";
    ctx.fillText(label.toUpperCase(), x, baseY);
    ctx.fillStyle = INK;
    ctx.font = "700 34px 'Space Grotesk', sans-serif";
    ctx.fillText(value, x, baseY + 52);
  });

  // QR to the public verification page
  const qrData = await QRCode.toDataURL(data.verifyUrl, { margin: 1, width: 320 });
  const qr = new Image();
  qr.src = qrData;
  await qr.decode();
  ctx.drawImage(qr, W - 380, H - 400, 240, 240);
  ctx.textAlign = "center";
  ctx.fillStyle = MUTED;
  ctx.font = "400 22px 'DM Sans', sans-serif";
  ctx.fillText(c.verify, W - 260, H - 130);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(220, 1250);
  ctx.lineTo(700, 1250);
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = "400 26px 'DM Sans', sans-serif";
  ctx.fillText(c.sign, 220, 1295);

  return canvas;
}

export async function downloadCertificatePdf(data: CertificateData) {
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = await drawCertificate(data);
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageW, pageH);
  pdf.save(`${data.certificateId}.pdf`);
}
