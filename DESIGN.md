# DESIGN.md

Dirección de diseño de la app de Network Speed Fibra (órdenes, técnicos, Finanzas, Revisión, Infraestructura). Recoge las decisiones tomadas el 2026-10-27 y lo que ya está en el código. Es dirección, no una lista de reglas nuevas: si algo de aquí choca con lo que Luis pida, manda lo que Luis pida.

## Quién la usa

- Los técnicos, casi siempre en el celular y al aire libre (≈99 % del uso). Prima lo táctil, el contraste y la lectura rápida.
- La oficina (administrador, usuario, almacén, finanzas, infraestructura, promotoras), en PC y en celular.
- Los técnicos no tienen acceso a SmartOLT: ningún enlace ni dato de SmartOLT se les muestra.

## Identidad

- Negro, rojo y el logo NS real. Es una marca de telecomunicaciones: seria, directa, sin adornos.
- El motivo propio es la **línea roja**: borde inferior del encabezado y del menú lateral (4 px, alineados a 62 px), borde vertical del login en PC, raya horizontal en el login del celular. No usarla como adorno en otros sitios.
- El rojo es acento: línea, botón principal de marca, avisos de peligro. No pintar con rojo todo lo clicable.
- Tema claro y oscuro con selector. Fondo de página gris (`zinc-200`) en claro y `zinc-950` en oscuro; las tarjetas son blancas o `zinc-900`.

## Login

- Variante "Dividida". PC: panel izquierdo negro con el ícono de marca grande y difuminado en los bordes, título "Control de Asignaciones", borde rojo de 8 px; el formulario a la derecha, más claro (en oscuro, `zinc-900`). Celular: marca compacta arriba y la raya roja horizontal.
- Campos de 48 px de alto, etiquetas arriba, "Mostrar/Ocultar" en texto, error en `role="alert"`.

## Tipografía

- Inter variable, con números tabulares. Un solo tipo de letra.
- Títulos de módulo en `font-black` con tracking ajustado. El peso medio y negrita separan jerarquía; no el tamaño.
- Tamaño mínimo de texto: 11 px en PC y 12 px en celular. Nada de 9 o 10 px.
- Mayúsculas solo donde ya son parte del dato: encabezados de tabla, estados, tipos de trabajo, el rol y la marca. El resto va en minúsculas normales, sin tracking ancho.

## Color y estados

- Estados de orden: PENDIENTE `slate-600`, PRE-FINALIZADO ámbar con texto negro en negrita, FINALIZADO `emerald-700`, CANCELADO `red-700`. Todos con texto que pase 4.5:1.
- Tipos de trabajo con su etiqueta de color suave (avería rojo, instalación azul, reconexión verde, etc.), siempre con el nombre escrito.
- El técnico se muestra como **texto neutro** (nombre en negrita). Sin chip, sin color propio y sin punto de color: el único círculo en las listas es el de activo/inactivo. El color del técnico se conserva solo en los filtros de arriba y en las pantallas de Técnicos.
- Los filtros de técnico son píldoras neutras; el estado activo/inactivo va en el texto.
- Un color nunca va solo: todo estado lleva texto o ícono.
- Grises de texto sobre blanco: `zinc-600` o más oscuro. `zinc-400` solo sobre fondos oscuros.

### Tokens de color (rediseño, rama `rediseno`)

- Dirección elegida el 2026-11-16: **negro y rojo, afinado**. Neutros zinc, rojo de marca `#DC2626` solo para marca, botón principal y peligro; el botón principal es rojo.
- Los colores tienen nombre en `src/index.css` (`:root` y `.dark`): `background`, `card`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning`, `border`, `input`, `ring` y sus `-foreground`. Se usan como `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`.
- Pantalla nueva o migrada: usar estos nombres y no `zinc-`/`red-` sueltos. Para cambiar un color de toda la app se cambia solo ahí.
- Las pantallas que no se han migrado siguen con `zinc-`/`red-` directos y se ven igual que antes. Los componentes de `src/components/ui/` (shadcn) ya usan los tokens.

### Estilo D (celular y PC) "tarjetas suaves" (rediseño, decidido el 2026-11-16)

- Por debajo de `lg` (1024 px) las pantallas migradas se ven en estilo D: fondo cálido (`#F4F2EF`, en oscuro `#0C0A09`), tarjetas blancas (`#1C1917` en oscuro) muy redondeadas con sombra suave, etiquetas de estado en pastel y botones principales en cápsula con brillo rojo. La PC no cambia.
- Se logra con tokens de forma que cambian por breakpoint en `src/index.css`: `rounded-card` (22 px en celular, 10 px en PC), `rounded-campo` (16 / 8 px), `rounded-boton` (cápsula / 8 px), `shadow-card` y `shadow-boton`. Una pantalla migrada usa solo estos nombres y no repite reglas por tamaño.
- Esto **sustituye en celular** a la regla de "radios chicos, sombras solo en modales y menús" de más abajo, en las pantallas migradas. En PC y en las pantallas sin migrar sigue valiendo esa regla.
- Se mantiene: contraste 4.5:1, controles de 44 px mínimo, texto de 12 px mínimo en celular, borde de campo a 3:1 (`--input`), la línea roja como motivo de marca y el color nunca solo.

- **Actualización (2026-11-16):** el estilo D vale ahora para **todas** las pantallas y tamaños, no solo el celular. Mismos colores en PC y celular (fondo cálido `#F4F2EF`, `#0C0A09` en oscuro). Las formas cambian por tamaño: tarjetas de 20 px en PC y 28 px en celular, campos de 14 y 18 px, botones en cápsula en los dos. Los encabezados de módulos y ventanas (`encabezado-d`) son claros con la línea roja corta de la marca; el encabezado de la app, el menú lateral y las tablas también. Lo que el párrafo anterior llama "PC no cambia" y la regla de radios chicos de más abajo quedan **sustituidos** por esto.



## Forma

- Radios chicos: `xl` = 8 px, `2xl` = 10 px. Nada de burbujas ni píldoras en tarjetas, ventanas y botones grandes.
- Sombras solo para elevar modales y menús. Sin brillos, sin vidrio esmerilado, sin degradados de moda.
- Pocos chips: una orden no lleva chips que repitan lo que ya dice el texto (por ejemplo, quién la creó va como "Creó usuario").

## Celular

- Todo control tocable mide al menos 44 × 44 px (regla global en `index.css` bajo `max-lg:`; la PC no cambia).
- Sin desborde horizontal a 320, 360 y 390 px.
- Las acciones principales de un formulario largo quedan fijas abajo.
- Nada que dependa de hover.

## Avisos y estados

- El aviso de "Activar notificaciones" sigue visible mientras el permiso no esté dado y no se puede ocultar: es lo que hace llegar las órdenes al técnico.
- Estados vacíos con una frase que diga qué hacer (por ejemplo, "Ninguna orden activa coincide con los filtros. Quítalos para ver todas, o crea una con Nuevo.").
- Los errores de formulario dicen qué falta, en texto y junto al campo.

## Texto de la interfaz

- Español, directo y tuteando, como ya está en la app ("Verifica", "Elige").
- Sin raya larga (—): se usa "-", punto o coma.
- Sin emojis como decoración, sin mensajes de relleno ni promesas.

## Movimiento

- Transiciones cortas (120 a 200 ms) y solo en PC (`lg:`). Sin animaciones infinitas ni pulsos decorativos.

## Accesibilidad

- Contraste AA: 4.5:1 para texto, 3:1 para bordes y controles. Se mide, no se estima.
- Cada ventana tiene nombre accesible y se cierra con Escape. Foco visible en todos los controles.
- Los campos llevan etiqueta.

## Lo que no se hace

- Rediseñar sin mostrar capturas antes y sin respetar esta dirección.
- Cambiar reglas de negocio al ajustar la interfaz.
