const KOT_META_START = '[[KOT_META]]';
const KOT_META_END = '[[/KOT_META]]';

export function createEmptyKotMeta() {
  return {
    version: 1,
    lineDetails: {},
    online: {
      source: null,
      fulfillmentType: null,
      workflowStatus: null,
      promisedAt: null,
      paymentState: null,
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      channelOrderId: '',
      acceptedAt: null,
      rejectedAt: null,
      readyAt: null,
      dispatchedAt: null,
    },
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
    online: {
      source: meta?.online?.source || null,
      fulfillmentType: meta?.online?.fulfillmentType || null,
      workflowStatus: meta?.online?.workflowStatus || null,
      promisedAt: meta?.online?.promisedAt || null,
      paymentState: meta?.online?.paymentState || null,
      customerName: meta?.online?.customerName || '',
      customerPhone: meta?.online?.customerPhone || '',
      customerAddress: meta?.online?.customerAddress || '',
      channelOrderId: meta?.online?.channelOrderId || '',
      acceptedAt: meta?.online?.acceptedAt || null,
      rejectedAt: meta?.online?.rejectedAt || null,
      readyAt: meta?.online?.readyAt || null,
      dispatchedAt: meta?.online?.dispatchedAt || null,
    },
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
    Object.values(normalized.online).some((value) => {
      if (typeof value === 'string') {
        return Boolean(value.trim());
      }

      return value !== null && value !== undefined;
    }) ||
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
