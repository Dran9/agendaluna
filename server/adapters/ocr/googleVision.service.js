import { env } from '../../utils/env.js';
import { AppError } from '../../services/errors.js';

function trimBase64Prefix(value) {
  const input = String(value || '').trim();
  const marker = 'base64,';
  const markerIndex = input.indexOf(marker);
  if (markerIndex >= 0) {
    return input.slice(markerIndex + marker.length);
  }
  return input;
}

export async function extractTextWithGoogleVision({ imageBase64 }) {
  const cleanBase64 = trimBase64Prefix(imageBase64);

  if (!cleanBase64) {
    return {
      provider: 'google_vision',
      enabled: false,
      fullText: '',
      reason: 'empty_image'
    };
  }

  if (!env.GOOGLE_VISION_API_KEY) {
    return {
      provider: 'google_vision',
      enabled: false,
      fullText: '',
      reason: 'not_configured'
    };
  }

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(env.GOOGLE_VISION_API_KEY)}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            image: { content: cleanBase64 },
            features: [{ type: 'TEXT_DETECTION' }]
          }
        ]
      })
    }
  );

  if (!response.ok) {
    throw new AppError('Google Vision request failed', 502, 'upstream_error');
  }

  const payload = await response.json();
  const first = payload?.responses?.[0] || {};

  return {
    provider: 'google_vision',
    enabled: true,
    fullText: first?.fullTextAnnotation?.text || '',
    warning: first?.error?.message || null
  };
}
