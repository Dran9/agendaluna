import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePaymentEvidence, evaluateVoucherText } from '../server/services/paymentsReview.service.js';

test('OCR parser recomienda verified cuando monto coincide', () => {
  const result = evaluateVoucherText({
    rawText: 'Comprobante transferencia\nMonto Bs 160.00\nRef TRX-998877\nFecha 05/05/2026',
    expectedAmountCents: 16000
  });

  assert.equal(result.recommendation, 'verified');
  assert.equal(result.extracted.amountCents, 16000);
  assert.equal(result.extracted.reference, 'TRX-998877');
});

test('OCR parser recomienda rejected cuando monto se desvía fuerte', () => {
  const result = evaluateVoucherText({
    rawText: 'Total Bs 480.00\nOperacion 1223344',
    expectedAmountCents: 16000
  });

  assert.equal(result.recommendation, 'rejected');
});

test('analyzePaymentEvidence usa texto manual sin google vision', async () => {
  const result = await analyzePaymentEvidence({
    expectedAmountCents: 18000,
    ocrText: 'Pago de Bs 180,00 referencia ABCD1234',
    imageBase64: ''
  });

  assert.equal(result.source, 'manual_text');
  assert.equal(result.extracted.amountCents, 18000);
});
