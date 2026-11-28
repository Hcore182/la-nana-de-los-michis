# Activar la agenda en Google Sheets

Con esto, cada reserva de la página queda guardada en una hoja de cálculo de Google,
las horas reservadas dejan de aparecer disponibles y les llega un correo con botones
para **Confirmar** o **Cancelar**. Se hace una sola vez y toma unos 10 minutos.

Háganlo desde un computador, con la cuenta de Google donde quieren recibir los correos.

## 1. Crear la hoja

1. Entren a [sheets.new](https://sheets.new) (crea una hoja nueva).
2. Pónganle de nombre **Reservas La nAna de los Michis**.

## 2. Pegar el programa

1. En la hoja: menú **Extensiones → Apps Script**. Se abre el editor en otra pestaña.
2. Borren todo lo que aparece en `Código.gs`.
3. Copien todo el contenido del archivo [`Codigo.gs`](Codigo.gs) y péguenlo ahí.
4. Arriba, cambien el nombre del proyecto a **Agenda La nAna**.
5. Guarden con el ícono de disquete (o `Ctrl + S`).
6. Menú de la izquierda → ⚙️ **Configuración del proyecto** → **Zona horaria**: elijan
   **(GMT-05:00) Bogotá**.

## 3. Preparar la hoja (una vez)

1. Vuelvan al editor (`< >` en el menú de la izquierda).
2. Arriba, en la lista de funciones, elijan **setup** y pulsen **▶ Ejecutar**.
3. Google pedirá permisos:
   - **Revisar permisos** → elijan su cuenta.
   - Saldrá "Google no ha verificado esta aplicación". Es normal: la app es suya y solo
     ustedes la usan. Pulsen **Configuración avanzada → Ir a Agenda La nAna (no seguro)**.
   - **Permitir**. Los permisos son para: editar esta hoja, enviarles el correo de cada
     reserva y revisar cada 15 minutos las reservas vencidas.
4. Vuelvan a la hoja: debe aparecer una pestaña **Reservas** con los encabezados en rosado.

## 4. Publicarlo para la página

1. En el editor, arriba a la derecha: **Implementar → Nueva implementación**.
2. En el engranaje ⚙️ de "Seleccionar tipo", elijan **Aplicación web**.
3. Llenen así:
   - Descripción: `Agenda página`
   - **Ejecutar como: Yo** (su correo)
   - **Quién tiene acceso: Cualquier usuario**
4. **Implementar**. Copien la **URL de la aplicación web** (termina en `/exec`).

> "Cualquier usuario" permite que la página guarde reservas y consulte las horas
> ocupadas. Nadie puede ver los datos de sus clientes: la hoja sigue siendo privada y la
> página solo recibe fecha y hora de las horas ocupadas.

## 5. Conectar la página

Envíenle la URL a Claude, o péguenla ustedes en `index.html`, en el bloque de configuración:

```js
bookingApiUrl: "https://script.google.com/macros/s/XXXXXXXX/exec",
```

Suban el cambio a GitHub y listo.

## Uso diario

| Situación | Qué hacer |
|---|---|
| Llega una reserva | Les llega un correo "😻 Nueva reserva LNM-XXXX". La hora queda bloqueada como **pendiente**. |
| El cliente paga y envía el comprobante por WhatsApp | Busquen el código `LNM-XXXX` del mensaje en su correo y pulsen **✅ Confirmar**. |
| Llega un **cliente nuevo** (correo "🌟 Cliente nuevo") | Escríbanle para acordar el encuentro de bienvenida (gratis). Cuando lo acuerden, pulsen **✅ Confirmar** para dejar el horario reservado. El pago lo hace en el encuentro, con ustedes presentes. |
| El cliente no paga | No hagan nada: a la **1 hora** pasa sola a **vencida** y la hora se libera. |
| El cliente cancela | Pulsen **❌ Cancelar** en el correo, o cambien el estado en la hoja. |
| Quieren ver la agenda | Abran la hoja (también funciona en la app de Google Sheets del celular) y filtren por fecha. |

El **Estado** de cada reserva también se puede cambiar a mano en la hoja, con la lista desplegable:
`pendiente`, `confirmada`, `cancelada`, `vencida`. Solo `pendiente` (menos de 1 hora) y
`confirmada` bloquean la hora.

No borren filas ni cambien el orden de las columnas: el programa las lee por posición.

## Agregar otro correo (por ejemplo, el de la nAna)

1. En el editor de Apps Script, cerca del inicio de `Código.gs`, busquen:
   ```js
   NOTIFY_EMAILS: [],
   ```
   y escriban el correo entre comillas (varios se separan con coma):
   ```js
   NOTIFY_EMAILS: ['correo.de.la.nana@gmail.com'],
   ```
2. Guarden y publiquen una versión nueva (ver "Si cambian el programa", abajo).
   Para no publicar el correo en GitHub, guarden esa versión como `Codigo.local.gs`
   (Git la ignora) y peguen ese archivo en Apps Script.
3. Para que también pueda **ver y editar la hoja**: en la hoja, botón **Compartir** →
   escriban su correo → rol **Editor** → **Enviar**.

Los botones **Confirmar** y **Cancelar** del correo funcionan desde cualquiera de las
cuentas que lo reciben.

## Si cambian el programa

Después de editar `Codigo.gs` en el editor: **Implementar → Administrar implementaciones →
✏️ Editar → Versión: Nueva versión → Implementar**. Así la URL no cambia.

Si cambian el horario de atención en la página (`firstHour`, `lastHour`), cámbienlo
también al inicio de `Codigo.gs` (`FIRST_HOUR`, `LAST_HOUR`).
