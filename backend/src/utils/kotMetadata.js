const KOT_META_START = '[[KOT_META]]';
const KOT_META_END = '[[/KOT_META]]';

export function createEmptyKotMeta() {
  return {
    version: 1,
    lineDetails: {},
    billing: {
      invoiceNumber: '',
      invoiceDate: null,
      subtotal: 0,
      orderDiscountAmount: 0,
      managerDiscountPercent: 0,
      managerDiscountAmount: 0,
      taxableAmount: 0,
      gstPercent: 0,
      cgstRate: 0,
      sgstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      packingCharge: 0,
      serviceCharge: 0,
      deliveryCharge: 0,
      chargesTotal: 0,
      loyaltyRedeemedAmount: 0,
      loyaltyRedeemedPoints: 0,
      roundOff: 0,
      grandTotal: 0,
      paymentMode: '',
      paidAmount: 0,
      cashierName: '',
    },
    discountApproval: {
      percent: 0,
      note: '',
      approvedBy: '',
      approvedAt: null,
    },
    loyalty: {
      customerPhone: '',
      earnedPoints: 0,
      redeemedPoints: 0,
      redeemedAmount: 0,
      availablePointsBefore: 0,
      availablePointsAfter: 0,
      finalPayableTotal: 0,
      settledAt: null,
    },
    system: {
      orderOrigin: null,
      deletion: {
        isDeleted: false,
        deletedAt: null,
        deletedReason: '',
      },
    },
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
    billing: {
      invoiceNumber: meta?.billing?.invoiceNumber || '',
      invoiceDate: meta?.billing?.invoiceDate || null,
      subtotal: Number(meta?.billing?.subtotal || 0),
      orderDiscountAmount: Number(meta?.billing?.orderDiscountAmount || 0),
      managerDiscountPercent: Number(meta?.billing?.managerDiscountPercent || 0),
      managerDiscountAmount: Number(meta?.billing?.managerDiscountAmount || 0),
      taxableAmount: Number(meta?.billing?.taxableAmount || 0),
      gstPercent: Number(meta?.billing?.gstPercent || 0),
      cgstRate: Number(meta?.billing?.cgstRate || 0),
      sgstRate: Number(meta?.billing?.sgstRate || 0),
      cgstAmount: Number(meta?.billing?.cgstAmount || 0),
      sgstAmount: Number(meta?.billing?.sgstAmount || 0),
      packingCharge: Number(meta?.billing?.packingCharge || 0),
      serviceCharge: Number(meta?.billing?.serviceCharge || 0),
      deliveryCharge: Number(meta?.billing?.deliveryCharge || 0),
      chargesTotal: Number(meta?.billing?.chargesTotal || 0),
      loyaltyRedeemedAmount: Number(meta?.billing?.loyaltyRedeemedAmount || 0),
      loyaltyRedeemedPoints: Number(meta?.billing?.loyaltyRedeemedPoints || 0),
      roundOff: Number(meta?.billing?.roundOff || 0),
      grandTotal: Number(meta?.billing?.grandTotal || 0),
      paymentMode: meta?.billing?.paymentMode || '',
      paidAmount: Number(meta?.billing?.paidAmount || 0),
      cashierName: meta?.billing?.cashierName || '',
    },
    discountApproval: {
      percent: Number(meta?.discountApproval?.percent || 0),
      note: meta?.discountApproval?.note || '',
      approvedBy: meta?.discountApproval?.approvedBy || '',
      approvedAt: meta?.discountApproval?.approvedAt || null,
    },
    loyalty: {
      customerPhone: meta?.loyalty?.customerPhone || '',
      earnedPoints: Number(meta?.loyalty?.earnedPoints || 0),
      redeemedPoints: Number(meta?.loyalty?.redeemedPoints || 0),
      redeemedAmount: Number(meta?.loyalty?.redeemedAmount || 0),
      availablePointsBefore: Number(meta?.loyalty?.availablePointsBefore || 0),
      availablePointsAfter: Number(meta?.loyalty?.availablePointsAfter || 0),
      finalPayableTotal: Number(meta?.loyalty?.finalPayableTotal || 0),
      settledAt: meta?.loyalty?.settledAt || null,
    },
    system: {
      orderOrigin:
        meta?.system?.orderOrigin === 'qr' || meta?.system?.orderOrigin === 'pos'
          ? meta.system.orderOrigin
          : null,
      deletion: {
        isDeleted: Boolean(meta?.system?.deletion?.isDeleted),
        deletedAt: meta?.system?.deletion?.deletedAt || null,
        deletedReason: meta?.system?.deletion?.deletedReason || '',
      },
    },
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
    Boolean(normalized.billing.invoiceNumber) ||
    normalized.billing.grandTotal > 0 ||
    normalized.discountApproval.percent > 0 ||
    Boolean(normalized.discountApproval.approvedAt) ||
    Boolean(normalized.loyalty.customerPhone) ||
    normalized.loyalty.earnedPoints > 0 ||
    normalized.loyalty.redeemedPoints > 0 ||
    Object.values(normalized.online).some((value) => {
      if (typeof value === 'string') {
        return Boolean(value.trim());
      }

      return value !== null && value !== undefined;
    }) ||
    Boolean(normalized.system.orderOrigin) ||
    normalized.system.deletion.isDeleted ||
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
