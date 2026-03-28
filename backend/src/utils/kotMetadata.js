const KOT_META_START = '[[KOT_META]]';
const KOT_META_END = '[[/KOT_META]]';

export function createEmptyKotMeta() {
  return {
    version: 1,
    lineDetails: {},
    kitchen: {
      lastSentSnapshot: [],
      tickets: [],
    },
  };
}

export function normalizeKotMeta(meta = {}) {
  return {
    version: Number(meta?.version || 1),
    lineDetails: meta?.lineDetails && typeof meta.lineDetails === 'object' ? meta.lineDetails : {},
    kitchen: {
      lastSentSnapshot: Array.isArray(meta?.kitchen?.lastSentSnapshot) ? meta.kitchen.lastSentSnapshot : [],
      tickets: Array.isArray(meta?.kitchen?.tickets) ? meta.kitchen.tickets : [],
    },
  };
}

export function splitNotesAndKotMeta(rawNotes = '') {
  const notesText = String(rawNotes || '');
  const startIndex = notesText.indexOf(KOT_META_START);

  if (startIndex === -1) {
    return {
      publicNotes: notesText.trim(),
      kotMeta: createEmptyKotMeta(),
      hasKotMeta: false,
    };
  }

  const endIndex = notesText.indexOf(KOT_META_END, startIndex + KOT_META_START.length);
  if (endIndex === -1) {
    return {
      publicNotes: notesText.trim(),
      kotMeta: createEmptyKotMeta(),
      hasKotMeta: false,
    };
  }

  const publicNotes = `${notesText.slice(0, startIndex)}${notesText.slice(endIndex + KOT_META_END.length)}`.trim();
  const rawMeta = notesText.slice(startIndex + KOT_META_START.length, endIndex).trim();

  try {
    return {
      publicNotes,
      kotMeta: normalizeKotMeta(JSON.parse(rawMeta)),
      hasKotMeta: true,
    };
  } catch {
    return {
      publicNotes,
      kotMeta: createEmptyKotMeta(),
      hasKotMeta: false,
    };
  }
}

function hasKotPayload(kotMeta = {}) {
  const normalized = normalizeKotMeta(kotMeta);
  return (
    Object.keys(normalized.lineDetails).length > 0 ||
    normalized.kitchen.lastSentSnapshot.length > 0 ||
    normalized.kitchen.tickets.length > 0
  );
}

export function composeNotesWithKotMeta(publicNotes = '', kotMeta = {}) {
  const cleanPublicNotes = String(publicNotes || '').trim();
  const normalizedMeta = normalizeKotMeta(kotMeta);

  if (!hasKotPayload(normalizedMeta)) {
    return cleanPublicNotes;
  }

  const metaBlock = `${KOT_META_START}\n${JSON.stringify(normalizedMeta)}\n${KOT_META_END}`;
  return cleanPublicNotes ? `${cleanPublicNotes}\n${metaBlock}` : metaBlock;
}

export function appendPublicNote(rawNotes = '', noteToAppend = '') {
  const { publicNotes, kotMeta } = splitNotesAndKotMeta(rawNotes);
  const extraNote = String(noteToAppend || '').trim();

  if (!extraNote) {
    return composeNotesWithKotMeta(publicNotes, kotMeta);
  }

  const nextPublicNotes = publicNotes ? `${publicNotes}\n${extraNote}` : extraNote;
  return composeNotesWithKotMeta(nextPublicNotes, kotMeta);
}

export function replacePublicNotes(rawNotes = '', nextPublicNotes = '') {
  const { kotMeta } = splitNotesAndKotMeta(rawNotes);
  return composeNotesWithKotMeta(nextPublicNotes, kotMeta);
}

export function stripKotMetadata(rawNotes = '') {
  return splitNotesAndKotMeta(rawNotes).publicNotes;
}
