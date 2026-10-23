# Arte v2 · Guerra Saltana

Se utilizó **ImageGen integrado**, no el fallback CLI. La captura de Yorugua Soccer aportada por el usuario se usó como referencia de composición (escenario a toda ventana, panel oscuro, botones celeste/amarillo). No se copió su arte ni se recreó su campo de fútbol.

## Imágenes originales y prompts

Los prompts íntegros de las tres generaciones están en `public/assets/source/imagegen-prompts-v2.json`.

1. `public/assets/source/capy-soldiers-imagegen-v2.png`: hoja transparente, 6 columnas y 2 filas; carpinchos humanoides bípedos con uniforme celeste o naranja, chaleco, botas, bandana y lanzador. Poses: reposo, dos pasos, salto, disparo y daño. Dirección lateral derecha. Pixel art con siluetas expresivas.
2. `public/assets/source/costanera-imagegen-v2.png`: panorama pixel art de una costanera inspirada en Salto, río Uruguay, casas, vegetación, embarcadero y atardecer. Es una interpretación artística, no una reconstrucción geográfica exacta.
3. `public/assets/source/logo-imagegen-v2.png`: logo transparente con texto «GUERRA SALTANA», naranja con bandana celeste, sol y lanzadores cruzados.

## Archivos consumidos por el juego

- `public/assets/capy-atlas-v2.png` y `.json`: 12 frames de 64×64, alfa original conservado, muestreo NEAREST. La animación de caminar alterna dos pasos con reposo. Salto, disparo y daño son poses específicas. Reposo y eliminación incorporan transformaciones de Phaser.
- `public/assets/capy-portrait-v2.png`: primer frame para la ficha de la brigada del menú.
- `public/assets/costanera-v2.png`: panorama del menú a 1280×720.
- `public/assets/river-v2.png`: encuadre superior del panorama para que detrás de los cráteres se vea el río y no una segunda capa de suelo sólido.
- `public/assets/soil-v2.png`: franja de tierra del panorama utilizada dentro de la máscara destructible y en la extensión visual inferior.
- `public/assets/logo-v2.png`: logo adaptado a 480×360 para la interfaz.

Preparación técnica reproducible: `pnpm run assets`. No requiere una API key ni vuelve a generar imágenes. Las imágenes base se crearon mediante ImageGen y después se recortaron y adaptaron al atlas con pngjs; no se sustituyeron por dibujos geométricos del generador anterior.

La UI utiliza HTML/CSS con controles reales encima del canvas Phaser. Los iconos pequeños de armas y efectos son gráficos sencillos de CSS/Phaser. El fondo actual es una única ilustración panorámica; no se anuncia como tres capas nuevas de parallax separadas.

## UI v3 y fuente

La revisión v3 reemplaza la composición tomada de la referencia por una mesa de operaciones horizontal en papel, verde y terracota. El título y los dos integrantes de la brigada quedan libres sobre el escenario. El retrato naranja `public/assets/capy-orange-v3.png` procede del primer frame de la segunda fila de la misma hoja ImageGen; no es una nueva generación.

Los tags de nombres usan Press Start 2P, de CodeMan38, distribuida con licencia SIL Open Font License. Se instaló `@fontsource/press-start-2p` y se incluye la fuente local en `public/fonts/press-start-2p-latin.woff2`, junto a su licencia `OFL-Press-Start-2P.txt`. No se consulta un CDN en ejecución. La fuente se precarga en HTML y la escena espera su carga antes de dibujar texto en Canvas.

## Firma de SaltoUruguayServer

Logo oficial aportado por el usuario: https://saltouruguayserver.com/images/logo_salto.webp. Original conservado en `public/assets/source/saltouruguayserver-logo.webp`. La adaptación pixel se realizó con ImageGen integrado, preservando el monograma y los colores azul/violeta, y simplificando la ilustración interior. No es una reproducción idéntica píxel a píxel del original ni un logo nuevo para el juego.

El resultado de ImageGen se conserva en `public/assets/source/saltouruguayserver-pixel-imagegen.png`. `scripts/prepare-brand.ts` recorta el margen transparente y prepara `public/assets/saltouruguayserver-pixel.png` de 48×64 mediante NEAREST. Se muestra a 48×64 en escritorio y 24×32 en pantallas pequeñas, con `image-rendering: pixelated`. Se incluye en la barra superior, junto al nombre del juego, y enlaza al sitio oficial. No requiere conexión remota para cargar la imagen. El prompt completo está en `public/assets/source/saltouruguayserver-pixel-prompt.json`.

## Atlas de interfaz y silbato

ImageGen generó una hoja original transparente de 4 columnas y 3 filas: silbato, bandera de viento y estados del altavoz. Original y prompt en public/assets/source/ui-sprites-imagegen.png y ui-sprites-prompt.json. scripts/prepare-ui.ts prepara por NEAREST el atlas de 128×96 con 12 frames de 32×32 y JSON. La UI lo anima por pasos enteros con image-rendering pixelated; respeta movimiento reducido.

public/audio/turn-change.mp3 es una copia exacta del archivo aportado por el usuario. Se carga mediante Phaser y se reproduce a volumen 0.7 al avanzar de turno durante una partida. Respeta el interruptor de sonido. El aviso visual aparece también con sonido desactivado. Inicio, reinicio y primera instantánea tras reconexión no disparan un aviso falso.

Audio adicional aportado por el usuario: countdown-tick.mp3 (0.55), explosion.mp3 (0.22) y damage-hit.mp3 (0.45; original u_68csiaifb5-bulletimpact2-442718.mp3). Copias locales sin conversión. El impacto se limita a una reproducción simultánea para evitar sumar volúmenes al dañar varios personajes.

Victoria: audio original aportado victoria.mp3 copiado sin conversión como public/audio/victory.mp3, volumen 0.55. Confeti generado con elementos cuadrados CSS, colores del equipo y movimiento por pasos, sin imágenes externas. Se respeta la preferencia de movimiento reducido.
