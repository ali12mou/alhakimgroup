import { Setting } from "../models/Setting.js";

const ALLOWED_FIELDS = [
  "companyName",
  "companyEmail",
  "companyPhone",
  "companyContactName",
  "website",
  "address",
  "currency",
  "expirationAlertEnabled",
  "expirationAlertDays",
  "defaultBank",
  "bankName",
  "bankAccountHolder",
  "bankIban",
  "bankSwift",
  "documentHeader",
  "documentFooter",
  "logoDataUrl"
];

async function getOrCreateSettings() {
  let settings = await Setting.findOne({});
  if (!settings) {
    settings = await Setting.create({});
  }
  return settings;
}

export async function getSettings(req, res) {
  const base = await getOrCreateSettings();
  const settings = await Setting.findById(base._id).populate("defaultBank");
  return res.json(settings);
}

export async function updateSettings(req, res) {
  const settings = await getOrCreateSettings();
  for (const key of ALLOWED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(req.body, key)) continue;
    let val = req.body[key];
    if (key === "defaultBank") {
      if (val === "" || val === null || val === undefined) {
        settings.defaultBank = null;
      } else {
        settings.defaultBank = val;
      }
    } else {
      settings[key] = val;
    }
  }
  await settings.save();
  const fresh = await Setting.findById(settings._id).populate("defaultBank");
  return res.json(fresh);
}
