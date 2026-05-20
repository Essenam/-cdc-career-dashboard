function getEventTriggers(eventTitle, eventType) {
  const title = (eventTitle || '').toLowerCase();
  const type  = (eventType  || '').toLowerCase();
  const values = ['event:any'];
  if (title.includes('fair') || type.includes('fair') || type.includes('career fair')) values.push('event:career_fair');
  if (title.includes('negotiat') || title.includes('salary')) values.push('event:negotiation');
  return values;
}

function getAppointmentTriggers(appointmentTypes) {
  const t = (appointmentTypes || '').toLowerCase();
  const values = ['appointment:any'];
  if (t.includes('resume')) {
    values.push('appointment:resume');
    values.push('document:resume');
  }
  if (t.includes('mock') || t.includes('interview')) values.push('appointment:mock');
  if (t.includes('offer') || t.includes('negotiat') || t.includes('salary')) values.push('appointment:offer');
  return values;
}

function getApplicationTriggers(status) {
  const values = ['application:any'];
  if ((status || '').toLowerCase() === 'accepted') values.push('application:accepted');
  return values;
}

module.exports = { getEventTriggers, getAppointmentTriggers, getApplicationTriggers };
