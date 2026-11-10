import umalqura from "@umalqura/core";

umalqura.locale("ar");

export interface HijriDate {
  year: number;
  month: number;
  day: number;
  monthName: string;
}

export interface GregorianDate {
  year: number;
  month: number;
  day: number;
  monthName: string;
  dayName: string;
}

const gregMonthNames = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const dayNames = [
  "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
];

const hijriMonthNames = [
  "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];

export function toHijri(date: Date): HijriDate {
  const { hy, hm, hd } = umalqura.$.gregorianToHijri(date);
  return { year: hy, month: hm, day: hd, monthName: hijriMonthNames[hm - 1] };
}

export function toGregorian(hy: number, hm: number, hd: number): Date {
  // Use the library's own Date constructor. hijriToGregorian() returns a
  // zero-based Gregorian month, so manually doing `new Date(gy, gm - 1, gd)`
  // shifted every converted date one month early.
  return umalqura.$.toDate(hy, hm, hd);
}

export function getTodayHijri(): HijriDate {
  return toHijri(new Date());
}

export function getTodayGregorian(): GregorianDate {
  return formatGregorian(new Date());
}

export function formatGregorian(date: Date): GregorianDate {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    monthName: gregMonthNames[date.getMonth()],
    dayName: dayNames[date.getDay()],
  };
}

export function formatHijriLong(date: Date): string {
  return umalqura.$.format(date, "dddd، d MMMM yyyy");
}

export function formatHijriShort(date: Date): string {
  return umalqura.$.format(date, "yyyy/MM/dd");
}

export function formatGregorianLong(date: Date): string {
  const g = formatGregorian(date);
  return `${g.dayName} ${g.day} ${g.monthName} ${g.year}`;
}

export function formatGregorianShort(date: Date): string {
  const g = formatGregorian(date);
  return `${String(g.year)}/${String(g.month).padStart(2, "0")}/${String(g.day).padStart(2, "0")}`;
}

export function isValidHijriDate(hy: number, hm: number, hd: number): boolean {
  if (hm < 1 || hm > 12) return false;
  if (hd < 1 || hd > 30) return false;
  try {
    const { gy, gm, gd } = umalqura.$.hijriToGregorian(hy, hm, hd);
    return gy >= 1900 && gy <= 2100;
  } catch {
    return false;
  }
}

export const hijriMonths = hijriMonthNames;
export const gregMonths = gregMonthNames;
