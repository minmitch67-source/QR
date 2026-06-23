import crypto from 'crypto';

// --- Normalization -------------------------------------------------------
// Collapse free-text spelling/spacing/punctuation variants to one form.
// "498CSSB", "498 cssb", "498-CSSB", "498 CSSB." -> "498 CSSB"
function normalize(raw) {
  return (raw || '')
    .toUpperCase()
    .replace(/[._,]/g, ' ')            // punctuation -> space
    .replace(/[\/\\\-]/g, ' ')          // separators (/ \ -) -> space
    .replace(/(\d)([A-Z])/g, '$1 $2')   // 498CSSB -> 498 CSSB
    .replace(/([A-Z])(\d)/g, '$1 $2')   // HHC498 -> HHC 498
    .replace(/\s+/g, ' ')               // collapse whitespace
    .trim();
}

// Strip a leading company/battery/detachment designator so subordinate
// elements roll up to their parent battalion:
//   "A CO 498 CSSB" / "HHC 498 CSSB" / "B BTRY 2 1 FA" -> battalion-level
function stripPrefix(s) {
  let p = s;
  p = p.replace(/^(HH[CDB]|HSC|FSC)\b\s*/, '');
  p = p.replace(/^([A-F]|ALPHA|BRAVO|CHARLIE|DELTA|ECHO|FOXTROT|FOX)\s+(CO|COMPANY|BTRY|BATTERY|TRP|TROOP|DET|DETACHMENT)\b\s*/, '');
  p = p.replace(/^(CO|COMPANY|BTRY|BATTERY|TRP|TROOP|DET|DETACHMENT)\b\s*/, '');
  return p.trim() || s;
}

// --- 19th ESC task organization -----------------------------------------
// EDIT THIS LIST to match your actual CJLOTS 2026 task org. Any unit that
// matches rolls up to the named battalion; anything not listed keeps its
// own normalized name as its group.
export const BATTALIONS = [
  { id: '498-CSSB', name: '498th CSSB',                 match: /\b498\b/ },
  { id: '25-TRANS', name: '25th Transportation Bn',     match: /(\b25\b.*\b(TRANS|TC)\b)|TRANSPORTATION/ },
  { id: '6-ORD',    name: '6th Ordnance Bn',            match: /(\b6\b.*ORD)|ORDNANCE/ },
  { id: '168-MMB',  name: '168th Medical Bn',           match: /\b168\b/ },
  { id: '19-STB',   name: '19th ESC STB',               match: /\bSTB\b|SPECIAL TROOPS/ },
  { id: '501-SB',   name: '501st Sustainment Bde',      match: /\b501\b/ },
];

// Resolve any free-text unit to a grouping { key, label }.
export function unitGroup(raw) {
  const norm = stripPrefix(normalize(raw));
  for (const b of BATTALIONS) {
    if (b.match.test(norm)) return { key: b.id, label: b.name };
  }
  return { key: norm || 'UNSPECIFIED', label: norm || 'Unspecified' };
}

export function groupLabel(key) {
  const b = BATTALIONS.find(x => x.id === key);
  return b ? b.name : key;
}

// --- Per-unit signed token ----------------------------------------------
const SECRET = process.env.S1_SECRET || process.env.ADMIN_PIN || '3032';
export function unitToken(key) {
  return crypto.createHmac('sha256', SECRET).update(String(key)).digest('base64url').slice(0, 12);
}
