import { extractTextWithGoogleVision } from '../adapters/ocr/googleVision.service.js';

function parseAmountToCents(rawNumber) {
  const source = String(rawNumber || '').trim();
  if (!source) {
    return null;
  }

  const hasComma = source.includes(',');
  const hasDot = source.includes('.');

  let normalized;
  if (hasComma && hasDot) {
    const lastComma = source.lastIndexOf(',');
    const lastDot = source.lastIndexOf('.');
    if (lastComma > lastDot) {
      normalized = source.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = source.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = source.split(',');
    if (parts[parts.length - 1].length === 2) {
      normalized = source.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = source.replace(/,/g, '');
    }
  } else if (hasDot) {
    const parts = source.split('.');
    if (parts[parts.length - 1].length === 2) {
      normalized = source.replace(/,/g, '');
    } else {
      normalized = source.replace(/\./g, '');
    }
  } else {
    normalized = source;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value * 100);
}

function bestAmountCandidate(text, expectedAmountCents = null) {
  const contextual = [...text.matchAll(/(?:monto|importe|total|transferencia|pago|bob|bs\.?|bolivianos?)\D{0,20}(\d[\d.,]+)/gi)]
    .map((match) => parseAmountToCents(match[1]))
    .filter(Boolean);

  const generic = [...text.matchAll(/\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})\b|\b\d{3,}\b/g)]
    .map((match) => parseAmountToCents(match[0]))
    .filter(Boolean);

  const candidates = [...new Set([...contextual, ...generic])];
  if (!candidates.length) {
    return null;
  }

  if (expectedAmountCents === null) {
    return candidates.sort((a, b) => b - a)[0];
  }

  return candidates.sort(
    (a, b) =>
      Math.abs(a - expectedAmountCents) - Math.abs(b - expectedAmountCents)
  )[0];
}

function extractReference(text) {
  const match = text.match(
    /(?:nro\.?\s*operaci[oó]n|operaci[oó]n|referencia|ref\.?|transacci[oó]n)\s*[:#-]?\s*([a-z0-9-]{5,40})/i
  );
  if (match) {
    return match[1].toUpperCase();
  }

  const trxMatch = text.match(/\b(?:trx|op)-?[a-z0-9]{4,40}\b/i);
  return trxMatch ? trxMatch[0].toUpperCase() : null;
}

function extractDate(text) {
  const ddmmyyyy = text.match(/\b(\d{2})[\/-](\d{2})[\/-](\d{4})\b/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  }

  const yyyymmdd = text.match(/\b(\d{4})[\/-](\d{2})[\/-](\d{2})\b/);
  if (yyyymmdd) {
    return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
  }

  return null;
}

export function evaluateVoucherText({ rawText, expectedAmountCents }) {
  const text = String(rawText || '').trim();
  if (!text) {
    return {
      recommendation: 'needs_review',
      confidence: 0.2,
      reasons: ['no_text_detected'],
      extracted: {
        amountCents: null,
        reference: null,
        operationDate: null
      }
    };
  }

  const amountCents = bestAmountCandidate(text, expectedAmountCents ?? null);
  const reference = extractReference(text);
  const operationDate = extractDate(text);

  const reasons = [];
  if (!amountCents) {
    reasons.push('amount_not_detected');
  }

  if (!reference) {
    reasons.push('reference_not_detected');
  }

  const expected = Number.isFinite(expectedAmountCents) ? expectedAmountCents : null;
  let recommendation = 'needs_review';
  let confidence = 0.55;

  if (expected !== null && amountCents !== null) {
    const delta = Math.abs(expected - amountCents);
    const ratio = delta / Math.max(1, expected);

    if (delta <= 100 || ratio <= 0.01) {
      recommendation = 'verified';
      confidence = reference ? 0.92 : 0.86;
      reasons.push('amount_match');
    } else if (ratio > 0.08) {
      recommendation = 'rejected';
      confidence = 0.86;
      reasons.push('amount_mismatch_high');
    } else {
      recommendation = 'needs_review';
      confidence = 0.62;
      reasons.push('amount_mismatch_low');
    }
  }

  if (expected === null && amountCents !== null) {
    recommendation = 'needs_review';
    confidence = 0.6;
    reasons.push('no_expected_amount');
  }

  const hasCenterKeywords = /luna|mandala|centro/i.test(text);

  return {
    recommendation,
    confidence,
    reasons,
    extracted: {
      amountCents,
      reference,
      operationDate,
      hasCenterKeywords
    }
  };
}

export async function analyzePaymentEvidence({
  expectedAmountCents,
  ocrText,
  imageBase64
}) {
  let rawText = String(ocrText || '').trim();
  let source = 'manual_text';
  let providerMeta = null;

  if (!rawText && imageBase64) {
    const vision = await extractTextWithGoogleVision({ imageBase64 });
    rawText = String(vision.fullText || '');
    source = vision.enabled ? 'google_vision' : 'google_vision_unavailable';
    providerMeta = {
      provider: vision.provider,
      enabled: vision.enabled,
      reason: vision.reason || null,
      warning: vision.warning || null
    };
  }

  const evaluation = evaluateVoucherText({
    rawText,
    expectedAmountCents
  });

  return {
    source,
    providerMeta,
    rawTextSnippet: rawText.slice(0, 2000),
    recommendation: evaluation.recommendation,
    confidence: evaluation.confidence,
    reasons: evaluation.reasons,
    extracted: evaluation.extracted
  };
}
