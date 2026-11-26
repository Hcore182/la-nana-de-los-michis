# La Nana de los Michis

Landing de cuidado de gatos a domicilio en Fusagasugá, con agenda de visitas de 1 hora.

## Cómo verla
Abre `index.html` en el navegador. No necesita instalar nada.

`index.html#agendar` abre el calendario directamente (útil para compartir en redes).

## Cómo editarla
Todo lo que cambia seguido está en el bloque `SITE_CONFIG` al inicio de `index.html`:

- **whatsappNumber**: número que recibe las reservas (con indicativo 57).
- **prices**: tarifas (vienen de la calculadora de tarifas).
- **schedule**: horario de atención, anticipación mínima, días cerrados,
  días bloqueados (`blockedDates`) y horas ya reservadas (`bookedSlots`).
- **holidays**: festivos de Colombia (se cobran como domingo).

## Cómo funciona la agenda
El cliente elige servicio, día y hora y llena sus datos. La página arma el mensaje
y abre WhatsApp con la solicitud. La reserva se confirma por WhatsApp con el anticipo.
Para que una hora no vuelva a aparecer disponible, agrégala a `bookedSlots`.
