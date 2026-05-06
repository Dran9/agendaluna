import { ValidationError } from './errors.js';

export async function getPublicCatalog(connection, centerId = 1) {
  const [centerRows] = await connection.query(
    `SELECT c.id, c.name, c.slug, c.timezone,
            cs.brand_name, cs.logo_url, cs.support_whatsapp_text, cs.whatsapp_number
     FROM centers c
     LEFT JOIN center_settings cs ON cs.center_id = c.id
     WHERE c.id = ? AND c.status = 'active'
     LIMIT 1`,
    [centerId]
  );

  if (!centerRows[0]) {
    throw new ValidationError('Center not found or inactive');
  }

  const [serviceRows] = await connection.query(
    `SELECT id, name, description, duration_min, base_price_cents, currency
     FROM services
     WHERE center_id = ? AND is_active = 1
     ORDER BY is_featured DESC, id ASC`,
    [centerId]
  );

  const [therapistRows] = await connection.query(
    `SELECT id, full_name
     FROM therapists
     WHERE center_id = ? AND is_active = 1
     ORDER BY id ASC`,
    [centerId]
  );

  const center = centerRows[0];

  return {
    center: {
      id: center.id,
      brandName: center.brand_name || center.name,
      logoUrl: center.logo_url || '',
      supportWhatsappText:
        center.support_whatsapp_text ||
        'Hola, quisiera orientacion para elegir una terapia en Luna Mandala.',
      whatsappNumber: center.whatsapp_number || ''
    },
    services: serviceRows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      durationMin: row.duration_min,
      basePriceCents: row.base_price_cents,
      currency: row.currency
    })),
    therapists: therapistRows.map((row) => ({
      id: row.id,
      fullName: row.full_name
    }))
  };
}
