import type { Bank, Setting } from "./types";

export function serviceLabel(service: { designation?: string; name: string }) {
  return service.designation || service.name;
}

export function groupServicesByCategory<T extends { category?: string }>(services: T[]) {
  const map = new Map<string, T[]>();
  for (const service of services) {
    const category = service.category?.trim() || "Autres";
    const list = map.get(category);
    if (list) list.push(service);
    else map.set(category, [service]);
  }
  return [...map.entries()];
}

export function formatMoney(value: number, currency = "FDJ") {
  return `${Math.round(value).toLocaleString("fr-FR")} ${currency}`;
}

export function resolveCompanyBank(settings: Setting, banks: Bank[]) {
  const ref = settings.defaultBank;
  if (ref && typeof ref === "object" && "_id" in ref) {
    const b = ref as Bank;
    return {
      name: b.name,
      accountHolder: b.accountHolder,
      iban: b.iban || "",
      swift: b.swift || ""
    };
  }
  if (typeof ref === "string" && ref) {
    const b = banks.find((x) => x._id === ref);
    if (b) {
      return {
        name: b.name,
        accountHolder: b.accountHolder,
        iban: b.iban || "",
        swift: b.swift || ""
      };
    }
  }
  return {
    name: settings.bankName,
    accountHolder: settings.bankAccountHolder,
    iban: settings.bankIban,
    swift: settings.bankSwift
  };
}

type PdfWithImage = {
  addImage: (
    imageData: string,
    format: string,
    x: number,
    y: number,
    w: number,
    h: number
  ) => void;
};

export function addLogoToPdf(
  doc: PdfWithImage,
  dataUrl: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  if (!dataUrl) return;
  const m = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!m) return;
  const fmt = m[1].toLowerCase().startsWith("jpg") ? "JPEG" : "PNG";
  doc.addImage(m[2], fmt, x, y, w, h);
}
