export const mockCatalog = {
  center: {
    id: 1,
    brandName: 'Luna Mandala',
    logoUrl: '',
    supportWhatsappText:
      'Hola, quisiera orientacion para elegir una terapia en Luna Mandala.',
    whatsappNumber: '59170000000'
  },
  services: [
    {
      id: 1,
      name: 'Terapia Floral',
      description: 'Sesion de equilibrio emocional con esencias florales.',
      durationMin: 60,
      basePriceCents: 14000,
      currency: 'BOB'
    },
    {
      id: 2,
      name: 'Masaje Terapeutico',
      description: 'Trabajo corporal orientado a tension muscular y descanso.',
      durationMin: 75,
      basePriceCents: 18000,
      currency: 'BOB'
    },
    {
      id: 3,
      name: 'Reiki Integral',
      description: 'Armonizacion energetica con enfoque restaurativo.',
      durationMin: 60,
      basePriceCents: 16000,
      currency: 'BOB'
    }
  ],
  therapists: [
    { id: 1, fullName: 'Mara Quintana' },
    { id: 2, fullName: 'Sofia Velarde' },
    { id: 3, fullName: 'Camila Arze' }
  ]
};

export function buildMockAvailability({ serviceId, date, therapistId = null }) {
  const service = mockCatalog.services.find((item) => item.id === serviceId) || mockCatalog.services[0];
  const therapistList = therapistId
    ? mockCatalog.therapists.filter((item) => item.id === therapistId)
    : mockCatalog.therapists;

  const firstTherapist = therapistList[0] || mockCatalog.therapists[0];
  const starts = [
    `${date}T09:00:00.000Z`,
    `${date}T10:30:00.000Z`,
    `${date}T12:00:00.000Z`
  ];

  return {
    service: { id: service.id },
    recommendation: firstTherapist
      ? {
          therapistId: firstTherapist.id,
          therapistName: firstTherapist.fullName,
          reason: 'Disponible para este servicio y horario'
        }
      : null,
    slots: starts.map((startsAt, index) => ({
      startsAt,
      endsAt: new Date(
        new Date(startsAt).getTime() + service.durationMin * 60 * 1000
      ).toISOString(),
      therapists: therapistList.map((therapist) => ({
        therapistId: therapist.id,
        therapistName: therapist.fullName,
        roundRobinOrder: therapist.id
      })),
      candidates: therapistList.map((therapist, roomIndex) => ({
        therapistId: therapist.id,
        therapistName: therapist.fullName,
        roomId: roomIndex + 1,
        roomName: `Sala ${roomIndex + 1}`
      })),
      rank: index + 1
    }))
  };
}
