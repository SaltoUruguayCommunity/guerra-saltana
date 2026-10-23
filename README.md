# Guerra Saltana

Juego de artillería por turnos para SaltoUruguayServer. TypeScript en modo estricto, Phaser 3, Vite y servidor Node.js autoritativo con WebSocket. La dirección de arte v2 usa imágenes originales generadas con ImageGen: carpinchos humanoides, costanera y logo pixel art. No usa imágenes de otros juegos.

Incluye SaltoPlay SDK 0.3 en `public/sdk/saltoplay.js`, sincronizado con el portal. Al conectar una cuenta, muestra automáticamente «Bienvenido, {SaltoTag}» con avatar cuando los permisos lo permiten; se puede desactivar con `ui: { welcome: false }`. La UI usa cápsulas oscuras y animación de expansión con soporte para movimiento reducido. La UI unificada notifica los guardados de nube confirmados y presenta automáticamente los logros cuando una integración llama a `achievements.requestUnlock` y la API confirma un desbloqueo nuevo. Los logros deben existir en la consola; no se inventan ni se conceden por dibujar la notificación. Se puede usar `sdk.ui.notify`, `showAchievement` (sólo visual), `configure` y `dismissAll`; los tipos están en `src/saltoplay.d.ts`. No hace falta añadir otro aviso de logro al juego.

## Ejecutar

Node.js 22.12+ y pnpm 11:

```sh
pnpm install
pnpm run dev
```

Abrir la dirección de Vite (habitualmente http://localhost:5173). El comando inicia también el servidor en 8787. Dos jugadores locales comparten teclado/pantalla. Para online, crear sala y abrir otra pestaña o dispositivo con la dirección LAN que imprime Vite. Compartir el código. Ambos jugadores deben conectarse antes de empezar. No hay bots.

```sh
pnpm test
pnpm run typecheck
pnpm run build
pnpm run assets
```

Controles: A/D o flechas para mover, W para saltar, ratón o arriba/abajo para apuntar. Q baja la potencia y E la sube (mantener para ajuste continuo, 30 puntos porcentuales por segundo); −/+ ajustan un punto por pulsación o cinco con Shift. El deslizador muestra el mismo valor, limitado entre 20% y 100%. Estos atajos se desactivan fuera del turno de apuntado propio, en menús y mientras se escribe en un campo de texto. Espacio dispara; 1/2/3 cambian arma. Límite de movimiento 85 píxeles por turno; 45 segundos. Naranjazo explota al impacto, mate bomba rebota tres veces, chumbo tiene menor caída. Tres carpinchos por equipo. El agua/borde inferior elimina unidades. Botones táctiles incluidos.

## Arquitectura y red

La pantalla de carga está en el HTML inicial y mantiene el menú inactivo hasta que el juego está listo y se cumple una presentación mínima de 2,6 segundos. `src/loading-screen.ts` combina hitos reales (fuente, recursos Phaser y preparación del terreno); la barra no avanza mediante un temporizador. Al completarse permanece al menos 650 ms en «Brigada lista». Un archivo fallido mantiene visible el error y habilita «Reintentar carga». La salida dura 360 ms en pasos pixelados y respeta movimiento reducido.

Al comenzar una batalla local, reiniciarla o empezar una sala online nueva, `src/deployment.ts` presenta un despliegue de 3,2 segundos: compuertas, ambas brigadas, cuenta atrás y apertura al campo. El menú cambia al combate detrás de las compuertas cerradas. Durante ese intervalo se bloquean controles y no se consume el reloj del primer turno. En online el servidor reserva el mismo intervalo, rechaza acciones prematuras y comunica el tiempo de despliegue restante. Reconectar a una partida que ya empezó no repite la introducción. Los tiempos están en `shared/presentation.ts`. **Reiniciar el proceso Node existente después de actualizar** para aplicar el nuevo inicio autoritativo a las salas online.

`/docs/loading-preview.html` permite revisar el diseño inicial durante desarrollo. Es una vista estática del mismo HTML, sin avanzar la barra ni iniciar Phaser; no participa en el arranque del juego.

`shared/game.ts`: simulación fija 30 Hz, colisión por máscara de píxeles, terreno, turnos, explosiones y victoria. `shared/types.ts` define unidades, proyectiles, acciones y mensajes de red compartidos entre cliente y servidor. Las acciones entrantes conservan validación en ejecución; los tipos no sustituyen la validación de red. El servidor ejecuta la simulación y sólo acepta intenciones del jugador activo. Publica 10 estados/s, eventos de cráteres y máscara completa cada segundo y al reconectar. El cliente online no calcula daño. La sesión usa un secreto aleatorio guardado en sessionStorage; nunca es una credencial de la plataforma. La partida se pausa si falta un jugador y conserva la sala hasta diez minutos tras desconectarse todos. Estado en memoria: reiniciar Node pierde salas. Listado público sólo muestra salas abiertas. No hay espectadores ni persistencia de partidas.

`src/`: presentación Phaser, UI nativa superpuesta al escenario de toda la ventana y adaptador SaltoPlay. `src/saltoplay.d.ts` declara el contrato consumido del SDK original, que se mantiene sin modificar en JavaScript. `scripts/prepare-v2.ts` prepara el atlas y las texturas a partir de las imágenes ImageGen conservadas en `public/assets/source/`. `pnpm run assets` reconstruye esos archivos sin llamar de nuevo a ImageGen. El generador anterior se conserva con `pnpm run assets:legacy` y no se utiliza para los personajes de la versión actual.

Atlas v2: 12 frames de 64×64 (dos uniformes, seis poses por uniforme: reposo, dos pasos, salto, disparo y daño). Caminar intercala los pasos; reposo tiene un movimiento vertical de un píxel; disparo y daño tienen ventanas visuales; la eliminación reutiliza la pose de daño rotada. No se anuncia una animación de muerte dibujada por separado. Fondo y logo generados con ImageGen, suelo texturado extraído del fondo, cráteres mediante máscara dinámica, partículas de explosión de Phaser. Los archivos originales, los prompts completos y la procedencia están en [ASSETS.md](ASSETS.md).

Mundo de combate de 640×360, canvas `RESIZE` a toda la ventana, cámara con escala entera cuando cabe y fraccionaria en espacios menores, filtro NEAREST y suavizado desactivado. El menú y HUD viven en la misma superficie visual, encima del canvas. Pantalla completa opcional mediante el botón superior; ayuda de controles en un diálogo.

La UI militar usa una consola de campaña con paneles verde oliva, biseles duros, esquinas escalonadas y retícula táctica. Paleta: bosque `#18271c`, acero verde `#293d2a`, oliva `#536a38`, latón apagado `#b2bf70` y texto `#e1e9c5`. Press Start 2P identifica títulos, botones, HUD y tags; los textos de ayuda usan monospace para facilitar la lectura. No se emplean serifas, cursivas, papel ni paneles inclinados. `src/theme.css` se enlaza desde el `<head>` de `index.html`, de forma que la primera pintura de la página espera al CSS; no se importa desde JavaScript. El canvas arranca transparente para mantener el fondo CSS durante la carga. La fuente se sirve desde `public/fonts/`, con preload; Phaser se inicia después de cargarla para dibujar los tags correctamente desde su primer frame. La licencia OFL está junto al archivo. No hay llamadas a Google Fonts en ejecución.

`tsx` ejecuta el servidor, los scripts y las pruebas TypeScript. `pnpm run build` comprueba primero los tipos de todo el proyecto y después compila el cliente con Vite. Para ejecutar el servidor en producción, instalar también las dependencias de desarrollo, que incluyen `tsx`. `pnpm run format` aplica el formato de Prettier al código.

## SaltoUruguayServer: contrato real y límites

Documentación consultada el 23/10/2026 en el repositorio local oficial `play.saltouruguayserver.com/src/lib/docs.ts` y SDK `public/sdk/saltoplay.js` (v0.1). La consulta web de https://play.saltouruguayserver.com/ no fue accesible durante el desarrollo. Se incluye copia sin modificar del SDK real en `public/sdk/`.

Documentación del portal: https://play.saltouruguayserver.com/ (sección Developers). Métodos usados: `SaltoPlay.init`, `auth.getSession`, `auth.login`, `player.getSaltoTag`, `saves.get` y `saves.set`. Los resultados se guardan localmente y en el slot `stats` cuando hay sesión. Los conflictos de guardado se informan y no se sobreescriben automáticamente. Estas estadísticas son casuales del cliente, no resultados competitivos verificados.

Copiar `.env.example` a `.env.local`; registrar un cliente público OAuth con callback exacto en el portal y configurar `VITE_SALTOPLAY_CLIENT_ID` y `VITE_SALTOPLAY_REDIRECT_URI`. Reiniciar Vite. Sin configuración se juega como invitado. El SDK conserva tokens sólo en memoria. No se envían tokens del portal al servidor del juego. El nombre mostrado no es una identidad verificada por el servidor multijugador.

Clasificaciones, SDK de servidor y estadísticas competitivas verificadas NO están disponibles en el contrato consultado y no se inventan. Logros casuales existen en la plataforma pero requieren claves registradas; este juego no solicita desbloqueos sin ese registro.

El runtime hosted del portal restringe conexiones al propio origen y no ejecuta Node: **no permite este multijugador externo con su política actual**. Publicar como juego **external**, con OAuth; alojar `dist/` en HTTPS y Node en un servicio con WebSocket persistente. Configurar `VITE_WS_URL=wss://tu-servidor/ws` antes del build, o usar proxy del mismo origen para `/ws`. No subir el backend al ZIP estático del portal.

Producción: `pnpm run build`, servir `dist/`, ejecutar `pnpm run server` en Node. Configurar `PORT` y `ALLOWED_ORIGINS` (lista separada por comas) en el entorno del servidor; Node no carga `.env.local`, Vite sí. Terminar TLS en el proxy y permitir upgrade WebSocket. Una sola instancia mientras las salas estén en memoria; escalado horizontal necesita enrutamiento de sala y persistencia externa. No incluye matchmaking por habilidad, moderación ni protección distribuida contra abuso. Dependencias externas: hosting estático, servidor Node/WebSocket y cliente OAuth registrado para cuenta/nube.

## Recursos y licencia

Código y arte originales de este proyecto, disponibles para el propietario de SaltoUruguayServer. Phaser, ws, Vite y pngjs conservan sus licencias respectivas. El SDK incluido pertenece al repositorio de SaltoUruguayServer. No se incluyen marcas ni arte de Worms o Crazy Penguin Wars.

## Estado de SaltoPlay y multijugador

SaltoPlay aún no está operativo. Cuenta y multijugador figuran como Próximamente; el cliente no abre conexiones ni inicia OAuth, y el servidor rechaza las acciones de salas. Cuando se habilite, será obligatoria una cuenta conectada y su validación en servidor; no basta con una bandera autenticada enviada por el cliente. El protocolo previo queda conservado, con su prueba en test/network.future.ts, fuera de la suite activa hasta implementar esa validación.
