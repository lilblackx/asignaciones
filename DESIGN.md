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

## Estado del rediseño y lo que sigue (rama `rediseno`, al 2026-11-17)

### Cómo se revisa

`npm run auditar:diseno` (carpeta `scripts/auditoria-diseno/`). Por cada pantalla, en PC (1440 px), celular (390 px) y 320 px, en claro y en oscuro, mide el contraste, el tamaño mínimo de texto, el desborde horizontal, las áreas táctiles de 44 px (celular) y los controles o ventanas sin nombre, y guarda una captura. Requiere `npm run dev` y los emuladores con `npm run seed:emulator` (Revisión de órdenes necesita además `node scripts/seed-revision-minimo.mjs`). Lanza su propio navegador con un perfil temporal y lo borra al terminar. Los escenarios están en `escenarios.mjs` (login, tecnico1, tecnico2, admin-panel, admin-modulos, admin-reportes). La herramienta no ve textos cortados ni desalineaciones: hay que mirar las capturas. Una orden con todos los datos (NAP con coordenadas, ubicación, teléfono, observación, técnico, prioridad alta, cobro acordado) enseña problemas que las órdenes simples esconden: se crea a mano en el emulador desde "Nueva asignación".

### Decisiones tomadas (2026-11-17)

- **Tarjeta de orden en celular** (oficina y técnico, `TicketsMobileList`): el tipo de trabajo y la falla van bajo el código; sin círculos de ícono; la observación va en un bloque suave. En la oficina, una acción principal (Finalizar o Aprobar, en verde o azul sólido), una secundaria (Editar) y el menú "⋯" (`RowMenu` con `grande`) con Copiar plantilla, Escalar a infraestructura y Cancelar orden. La tarjeta de ventas, promotora e infraestructura (`TarjetaInstalacion`) solo se alineó (márgenes de 20 px y el tipo bajo el código).
- **El brillo de un botón es del color del botón.** `shadow-boton` (rojo) solo en los botones rojos; para los demás, `shadow-boton-azul`, `shadow-boton-verde` y `shadow-boton-ambar`. Un botón desactivado no lleva brillo.
- **Títulos de tarjeta y etiquetas de campo en minúscula normal** (`TITULO_SECCION`, `ETIQUETA_CAMPO`). Las mayúsculas con espaciado quedan para los encabezados de tabla (`ETIQUETA`), los estados, el rol y la marca.
- **Scrollbar discreto** en toda la app (fino, sin flechas, pista transparente, separado de las esquinas). No se declaran `scrollbar-width` ni `scrollbar-color` fuera del respaldo de Firefox: con ellos Chrome ignora las reglas `-webkit-`.
- **Nueva asignación:** campos agrupados (Cliente, Trabajo, Ubicación y red, Cobro acordado, Observación), errores en texto junto al campo (sin la burbuja del navegador), botones fijos abajo, cobro acordado plegable. Las opciones nuevas de los campos compartidos (`suave`, `error`) están apagadas por defecto: Editar orden y Nueva venta siguen como estaban.
- **Técnicos:** tarjetas con avatar de color, estado e interruptor "Recibe órdenes". **Usuarios:** lista a todo el ancho con avatar del color del rol, filtros por rol siempre visibles (en celular, en una fila que se desliza) y el formulario de "Nuevo usuario" solo cuando se pide con el botón rojo. **Historial:** atajos de estado con cantidades y encabezado de columnas en PC. **Revisión de órdenes:** cifras en tarjetas grandes, avisos agrupados en uno que se despliega, y por fila una acción principal con el resto en el menú "⋯".
- **Controles táctiles:** los enlaces de texto dentro de los modales miden 44 px de alto en celular. Un número dentro de un chip activo no lleva opacidad (da menos de 4.5:1 sobre el rojo).
- **Cabecera del menú lateral:** "Network Speed" con "Asignaciones" debajo y el logo cuadrado (también en el login móvil y en la cabecera móvil del técnico).

### Hecho

Con commits: la herramienta de auditoría; login, técnico en celular (lista, notificaciones, cuenta, filtros y los pasos de Pre-finalizar de visita e instalación); Reportes en PC (11 vistas y menús); Pre-finalizar en PC; Nueva asignación; modal "Orden finalizada" del técnico; menú lateral; scrollbar; buscadores con placeholder corto.

En el árbol de trabajo, sin commit al escribir esto: la tarjeta de orden en celular, Técnicos, Usuarios, Historial, Revisión de órdenes, las sombras por color, los enlaces táctiles, los estilos compartidos de título y etiqueta, y la descripción por opción en `SelectMenu` (el rol de Usuarios).

### Pendiente

1. **Avisos:** hechos el 2026-11-17 con un solo componente, `Aviso` (`src/components/Aviso.jsx`, niveles info, atención, error y éxito; título corto, detalle plegable, códigos como chips y una acción; sin título, el contenido es el mensaje). Lo usan los avisos de las listas, Revisión, Finanzas, Reportes, Inventario, Estaciones, Cobro, Pre-finalizar, Crear orden y otros. Quedan con su estilo, a propósito: los paneles de datos (resumen de la orden, Recableado, secciones de Usuarios y de Pre-finalizar, panel de la señal SmartOLT, respuesta de cobro del técnico), la franja de Sin conexión y los avisos dentro del encabezado de una ventana. Para un aviso nuevo, usar `Aviso`.
2. **Módulos:** revisados con la herramienta y a ojo el 2026-11-17: Dinero (Administración, Finanzas), Inventario y ventas (Almacén o Materiales, Envíos al inventario, Ventas, Infraestructura), Historial, los demás roles en su vista (promotora, almacén, finanzas, infraestructura, administración, usuario). Faltan solo Ubicación (apagado) y mirar a ojo Envíos al inventario y Ventas.
3. **Reportes en celular:** las 11 vistas están medidas, pero no revisadas a ojo.
4. **Flujo de cobro:** "Consultar cobro a la oficina" y el cobro resultante, en PC y celular. Escriben en el emulador.
5. **Editar orden** con el mismo diseño que Nueva asignación (grupos, errores en texto, botones fijos). Los componentes ya admiten `suave`.
6. **Decisiones de diseño abiertas:** el botón "Siguiente" verde de los asistentes (sistema de tonos) frente al rojo de marca; "Estoy en camino" en azul; los títulos de los modales en mayúsculas ("NUEVA ASIGNACIÓN", "DETALLE DE LA ORDEN") frente a la regla de minúscula normal; en Tasa y pagos y Configuración el título va a la izquierda y el contenido va centrado y más angosto.
7. **Tabla de órdenes en PC** (`TicketsTable`) y sus modales, revisados con una orden completa.
8. **Revisión final:** login oscuro y pantallas con datos reales (las capturas usan órdenes de prueba); `npm run build`.
9. **Modales de confirmación:** hechos el 2026-11-17. `DialogoConfirmacion` (ícono en cuadro suave con el título al lado, detalle, botones con la acción arriba en celular y en fila en PC, tono por nivel) lo usan `ConfirmModal`, Pre-finalizar, código fuera de secuencia, sin coordenadas y confirmar pago. Los de formulario (cancelar orden, escalar a infraestructura, anular pago) usan `AccionesConfirmacion` en el pie. Falta revisar `AprobarFinalizarModal` por dentro (sus confirmaciones sí usan el nuevo diálogo) y confirmar pago en pantalla.
10. **Reportes exportados en PDF y Word:** rediseñados el 2026-11-17 con el estilo de la app: ficha de marca (logo sobre cuadro negro redondeado) con la línea roja corta bajo el título, cifras en tarjetas suaves, tablas con encabezado claro y rayas finas, avisos en etiquetas de color suave, gráficas en rojo de marca y gris cálido, y nombres de técnicos con mayúscula inicial. Los PDF se revisaron en Brave; los Word no se pudieron abrir en Word desde aquí: abrir uno y confirmar la ficha de marca, la línea roja y las tarjetas. Falta mirar a ojo Pagos detallados y Resumen de pagos de Finanzas (con datos de pagos).
11. **Login en PC:** hecho el 2026-11-17 con la propuesta B (dividida suave): panel negro redondeado con el logo y el título, línea roja corta bajo el título, formulario en su propia tarjeta sobre el fondo cálido; el celular no cambió. Falta revisarlo con datos reales y con el logo de temporada apagado.
12. **Detalle de la orden (modal):** revisarlo por dentro, en celular y PC, claro y oscuro: el encabezado, las tarjetas de Cobro, Cliente, Orden e Historial, el orden de los datos, el espacio entre ellas y los textos (por ejemplo el técnico en mayúsculas). Pedido por Luis el 2026-11-17 con una captura del modal en oscuro.
13. **Panel de filtros del Panel principal:** hecho el 2026-11-17: título "Filtros" con "Limpiar filtros (N)" a la derecha (ya no gasta una fila abajo), los tres desplegables repartidos en todo el ancho en PC y, en celular, el estado arriba y trabajo y orden lado a lado. El valor por defecto del trabajo se llama "Todos" (la etiqueta de arriba ya dice "Trabajo").
14. **Panel de notificaciones (campana):** hecho el 2026-11-17: panel redondeado con título y "Borrar todas" en un botón de texto, cada aviso con su ícono en un círculo del tono de su nivel (ámbar, azul, verde o rojo), texto de 14 px, punto de no leído y botón de quitar; la fila "N órdenes esperando aprobación" como aviso ámbar suave y un estado vacío con mensaje. Se revisó como técnico en celular; falta mirar a ojo la campana de la oficina con avisos (se limpian solos mientras las órdenes siguen pre-finalizadas). Datos para verla: `node scripts/seed-notificaciones-emulator.mjs` con la app abierta.
15. **Toasts (avisos que salen abajo):** revisarlos: el color sólido (por ejemplo el rojo de "Te asignaron una nueva orden con PRIORIDAD ALTA"), el ancho y el texto, el ícono, el tiempo en pantalla, el botón de cerrar, la posición en celular y PC, y que sigan el mismo estilo de niveles que `Aviso` (info, atención, error, éxito). Pedido por Luis el 2026-11-17.
16. **Tarjeta de usuario del menú lateral:** revisar la tarjeta del pie del menú (nombre, rol con el punto verde, botón de tema y botón de cerrar sesión): la alineación de los botones con el nombre, el tamaño y el espacio, y cómo se ve con el menú colapsado, en celular, claro y oscuro. Pedido por Luis el 2026-11-17 con una captura en oscuro.
17. **Despliegue:** nada está subido. La rama `rediseno` está bloqueada para desplegar por el candado; no desplegar hasta que se levante.
