import { mirrorAppointment } from './noopCalendar.adapter.js';

export async function mirrorAppointmentOutbound(payload) {
  return mirrorAppointment(payload);
}
