# La nAna de los Michis

Landing de cuidado de gatos a domicilio en Fusagasugá, con agenda de visitas.

## Cómo verla
Abre `index.html` en el navegador. No necesita instalar nada.

`index.html#agendar` abre el calendario directamente (útil para compartir en redes).

## Cómo editarla
Todo lo que cambia seguido está en el bloque `SITE_CONFIG` al inicio de `index.html`:

- **whatsappNumber**: número que recibe las reservas (con indicativo 57).
- **prices**: tarifas. Para actualizarlas, en la calculadora de tarifas pulsa
  **Copiar precios para la web** y pega el texto en lugar del bloque `prices: { ... },`
  (incluye los precios exactos con 1 a 4 gatos en `byCats`).
- **schedule**: horario de atención, anticipación mínima, días cerrados,
  días bloqueados (`blockedDates`) y horas ya reservadas (`bookedSlots`).
- **holidays**: festivos de Colombia (se cobran como domingo).

## Cómo funciona la agenda
El cliente elige servicio, día y hora y llena sus datos. La página arma el mensaje
y abre WhatsApp con la solicitud. La reserva se confirma por WhatsApp con el anticipo.
Para que una hora no vuelva a aparecer disponible, agrégala a `bookedSlots`.
