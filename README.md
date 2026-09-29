# ba-market-board

Tablero de una sola página con el clima actual de Buenos Aires, los precios de cinco CEDEAR
seleccionados y la cotización del dólar MEP/bolsa. Cada carga de página produce **una** instantánea
("snapshot"): el navegador hace **una** consulta a la API, el servidor consulta las tres fuentes en
paralelo y renderiza el resultado. No hay polling, ni reintentos automáticos, ni historial.

No requiere Docker, ni paso de compilación, ni instalación de dependencias, ni claves de API.

## Requisitos previos

- **Node.js 24 LTS** (probado también en v22.22.0; `package.json` declara `"node": ">=24"`).
- Un navegador moderno.
- Conexión a internet para ver el tablero en vivo. La suite de tests **no** necesita internet.

No hace falta Docker. No hay dependencias de runtime: el proyecto usa solo módulos de la biblioteca
estándar de Node (`node:http`, `node:fs/promises`, `node:path`, `node:url`, `fetch` nativo,
`AbortSignal`, `node:test`). No hay nada que instalar: `dependencies` está vacío.

## Cómo ejecutarlo

Desde la raíz del repositorio:

```bash
npm start
```

Salida esperada:

```text
ba-market-board listening on http://127.0.0.1:3000/
```

Abrí `http://127.0.0.1:3000/` en el navegador. **Volver a cargar la página es la única forma de
obtener una instantánea nueva.**

Sin el script de npm:

```bash
node src/server.js
```

Para elegir otra interfaz o puerto se usan dos variables de entorno, ambas no secretas:

```bash
PORT=3100 node src/server.js   # http://127.0.0.1:3100/
```

El host por defecto es `127.0.0.1` y el puerto por defecto es `3000`. `PORT` acepta un número entre 0
y 65535 y cualquier valor inválido se ignora en favor del puerto por defecto.

## Cómo correr los tests

```bash
npm test          # equivalente a: node --test
```

La suite son **exactamente 8 tests en 2 archivos**, contra un tope constitucional de 12:

| Archivo | Qué cubre |
|---------|-----------|
| `tests/render.test.js` | `GET /` devuelve la página con las tres regiones de widget; un widget fallido muestra su error visible y ningún valor numérico, sin tocar sus hermanos. |
| `tests/adapters.test.js` | Los tres adaptadores convierten una respuesta simulada válida en un valor, y una respuesta simulada con error en un error tipado sin datos sustitutos. |

Los tests inyectan su propia implementación de `fetch` con respuestas pequeñas escritas dentro del
archivo de test. No hay `tests/fixtures/`, ni helpers compartidos, ni dobles de prueba, y no se
contacta ningún proveedor real. Si el resumen `duration_ms` parece alto, es el costo de arranque del
proceso en entornos lentos o containerizados, no una espera ni un test colgado: cada cuerpo de test
tarda milisegundos.

## Qué muestra cada widget

Los tres widgets son independientes: cada uno muestra su propio estado de carga, su valor o su
error, y el fallo de uno no impide que los otros dos rendericen.

### Clima en Buenos Aires

Temperatura actual en grados Celsius, una etiqueta de condición derivada de una tabla fija de
códigos WMO, el nombre de la fuente y la hora de observación, marcada `Observado: `. Si la fuente no
entrega una hora válida, se muestra la hora de consulta marcada `Consultado: `. Son condiciones
actuales, no un pronóstico.

### CEDEARs

Cinco filas fijas, siempre en este orden y nunca en otro:

| Ticker | Etiqueta |
|--------|----------|
| `AAPL` | Apple |
| `MSFT` | Microsoft |
| `GOOGL` | Alphabet |
| `META` | Meta |
| `NVDA` | Nvidia |

Cada fila muestra ticker, etiqueta y precio local en pesos argentinos. La lista **no** se ordena por
volumen ni se recalcula: es una lista fija, y si falta cualquiera de los cinco valores el widget
completo muestra un error en lugar de una lista parcial o un ticker substituido. El esquema
documentado de la fuente no incluye una hora de cotización por ticker, así que la hora que se
muestra es la de consulta, marcada `Consultado: `, y nunca se presenta el precio como "en vivo".

### Dólar MEP/bolsa

El promedio de la compra y la venta de MEP/bolsa, en pesos argentinos por dólar, redondeado a dos
decimales, etiquetado `MEP/bolsa`, con los valores de compra y venta visibles y la hora de
actualización de la fuente marcada `Observado: ` (o `Consultado: ` si la fuente no la entrega).

**No hay fallback.** El widget nunca muestra el dólar oficial BNA, el blue ni el CCL, ni siquiera
cuando el MEP no está disponible: en ese caso muestra un error visible.

## Fuentes de datos

Las tres son públicas y gratuitas, se llaman sin credenciales y no se les envía ningún dato de
usuario. Cada petición tiene un timeout de **2500 ms** y **no** se reintenta.

| Widget | Fuente | Endpoint | Campo usado |
|--------|--------|----------|-------------|
| Clima | Open-Meteo | `https://api.open-meteo.com/v1/forecast` (`latitude=-34.6037`, `longitude=-58.3816`, `current=temperature_2m,weather_code`, `temperature_unit=celsius`, `timezone=America/Argentina/Buenos_Aires`) | `current.temperature_2m`, `current.weather_code`, `current.time` |
| CEDEARs | Data912 | `https://data912.com/live/arg_cedears` | `symbol`, `c` |
| MEP | DolarAPI | `https://dolarapi.com/v1/dolares/bolsa` | `compra`, `venta`, `fechaActualizacion` |

Además, cada adaptador rechaza datos que no son utilizables: una observación de clima con más de
**3 horas** se considera vieja, una cotización de mercado con más de **7 días** también, y una marca
de tiempo inválida o en un futuro improbable se rechaza. El mensaje de error nunca incluye el cuerpo
de la respuesta del proveedor ni un stack trace.

## API local

```bash
curl http://127.0.0.1:3000/api/dashboard
```

Devuelve `200 OK` con `Content-Type: application/json; charset=utf-8` y `Cache-Control: no-store`.
El cuerpo es un sobre con `retrievedAt` y un resultado por widget (`weather`, `cedears`, `mep`),
cada uno con `status: "ok"` o `status: "error"`. La respuesta es `200` incluso si una o dos fuentes
fallan: el fallo viaja dentro de su widget y los hermanos siguen visibles.

- Un método distinto de `GET` sobre `/api/dashboard` devuelve `405 Method Not Allowed`.
- Cualquier ruta que no sea `/api/dashboard` se resuelve contra una lista fija de cinco archivos
  estáticos (`/`, `/index.html`, `/styles.css`, `/app.js`, `/render.js`); el resto devuelve `404`.
- Un fallo interno al armar el sobre devuelve `500` con un mensaje genérico, sin detalles del
  proveedor.

## Cómo está armado

```text
src/
├── server.js              # sirve los estáticos y enruta GET /api/dashboard
├── config.js              # host, puerto, timeout y las tres URLs fijas
├── api/dashboard-route.js # handler del endpoint
├── dashboard/             # service.js (composición) y normalize.js (resultado ok/error)
├── lib/                   # json-fetch.js (timeout + errores tipados) y time.js (fechas y vencimientos)
├── sources/               # un adaptador por fuente
└── public/                # index.html, styles.css, app.js, render.js
```

La página son tres bloques apilados en una sola columna —`Clima`, `CEDEARs` y `Dólar MEP/bolsa`— y
cada bloque reparte un solo valor entre un elemento principal, que lleva el número dominante, y sus
elementos de apoyo, que se pueden tipografiar por separado.

El cliente (`src/public/app.js`) pide el snapshot una sola vez y delega el dibujo en
`src/public/render.js`, que solo usa `getElementById`, `textContent` y `hidden`: no crea elementos
ni interpola HTML. La página y los mensajes están en español, con formatos numéricos y de fecha
`es-AR`.

## Alcance

Lo que este tablero deliberadamente **no** hace:

- **No hay login, cuenta ni autenticación** de ningún tipo. La página es anónima.
- **No hay alertas, notificaciones, webhooks ni suscripciones.**
- **No hay gráficos ni historial.** No se guardan series ni datos entre peticiones.
- **No hay acciones de compraventa**: no se compra, no se vende, no hay portafolio ni mesa de operaciones.
- **No hay base de datos, caché ni persistencia.** Cada respuesta se arma y se descarta.
- **No hay planificador en segundo plano, ni cron, ni cola de trabajos.**
- **No hay polling.** El widget no se refresca solo; recargar la página es el único disparador.
- **No hay Docker, ni paso de compilación, ni CI, ni linter, ni umbral de cobertura.**
- **No hay ranking dinámico de CEDEARs** ni Cotizaciones del BNA, blue o CCL.
- **No hay forecasting**: el clima es una observación actual.

## Limitaciones conocidas

- A **320 px** de ancho las filas de CEDEAR se parten en dos líneas (por ejemplo
  `AAPL · Apple · 27.400 ARS`). No aparece scroll horizontal y la página sigue siendo legible, pero la
  lista se ve densa en un teléfono angosto.
- Los precios de CEDEAR no llevan hora de cotización propia porque la fuente no la publica; la hora
  que se ve es la de consulta.
- Los datos de mercado pueden venir demorados o no estar disponibles. El estado de error y la marca
  de tiempo son intencionales, no un defecto a corregir.

## Especificación

Este tablero se construyó con Spec-Driven Development. La especificación vigente, el plan, los
contratos y la lista de tareas están en
[`specs/002-dashboard-data-policy/`](specs/002-dashboard-data-policy/), y los principios del
proyecto en [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
