const ones = [
  "",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];

const tens = [
  "",
  "",
  "عشرون",
  "ثلاثون",
  "أربعون",
  "خمسون",
  "ستون",
  "سبعون",
  "ثمانون",
  "تسعون",
];

const hundreds = [
  "",
  "مائة",
  "مئتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
];

function convertBelowThousand(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ones[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return tens[t];
    return ones[u] + " و" + tens[t];
  }
  const h = Math.floor(n / 100);
  const r = n % 100;
  const hPart = hundreds[h];
  if (r === 0) return hPart;
  return hPart + " و" + convertBelowThousand(r);
}

function pluralSuffix(count: number, singular: string, dual: string, plural: string): string {
  if (count === 1) return singular;
  if (count === 2) return dual;
  if (count >= 3 && count <= 10) return plural;
  return singular;
}

const groupNames = [
  { divisor: 1e12, singular: "تريليون", dual: "تريليونان", plural: "تريليونات" },
  { divisor: 1e9, singular: "مليار", dual: "ملياران", plural: "مليارات" },
  { divisor: 1e6, singular: "مليون", dual: "مليونان", plural: "ملايين" },
  { divisor: 1000, singular: "ألف", dual: "ألفان", plural: "آلاف" },
];

function convertInteger(num: number): string {
  if (num === 0) return "صفر";
  if (num < 0) return "سالب " + convertInteger(Math.abs(num));

  let remaining = num;
  const parts: string[] = [];

  for (const group of groupNames) {
    if (remaining >= group.divisor) {
      const count = Math.floor(remaining / group.divisor);
      remaining %= group.divisor;
      const groupName = pluralSuffix(count, group.singular, group.dual, group.plural);
      if (count === 1) {
        parts.push(groupName);
      } else if (count === 2) {
        parts.push(groupName);
      } else {
        parts.push(convertBelowThousand(count) + " " + groupName);
      }
    }
  }

  if (remaining > 0) {
    parts.push(convertBelowThousand(remaining));
  }

  return parts.join(" و");
}

export function convertToArabicWords(value: number | string): string {
  if (typeof value === "string") {
    value = value.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
    value = value.replace(",", ".");
  }

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!isFinite(num)) return "";

  const raw = (typeof value === "string" ? value : num.toString()).trim();
  const negative = raw.startsWith("-");
  const unsigned = raw.replace(/^[+-]/, "");
  const dotIdx = unsigned.indexOf(".");

  if (dotIdx === -1) {
    return convertInteger(Math.round(num));
  }

  const intPart = unsigned.substring(0, dotIdx);
  const fracPart = unsigned.substring(dotIdx + 1);

  const intWords = intPart === "0" && fracPart.length > 0 ? "" : convertInteger(parseInt(intPart, 10));

  let leadingZeros = 0;
  for (const ch of fracPart) {
    if (ch === "0") leadingZeros++;
    else break;
  }
  const fracRemainder = fracPart.substring(leadingZeros);

  const fracWords: string[] = [];

  for (let i = 0; i < leadingZeros; i++) {
    fracWords.push("صفر");
  }

  if (fracRemainder.length > 0) {
    const remainderNum = parseInt(fracRemainder, 10);
    if (fracRemainder.length === 1) {
      fracWords.push(ones[remainderNum]);
    } else {
      fracWords.push(convertInteger(remainderNum));
    }
  }

  const body = intWords
    ? intWords + " فاصلة " + fracWords.join(" ")
    : "فاصلة " + fracWords.join(" ");
  return negative ? "سالب " + body : body;
}
