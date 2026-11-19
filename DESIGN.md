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

### Hecho el 2026-11-17 (rama `rediseno`)

- **Componentes globales nuevos:** `Aviso` (niveles info, atención, error y éxito), `BarraFiltros` y `FilaDeslizable` (filtros con periodo), `DialogoConfirmacion` y `AccionesConfirmacion` (confirmaciones), `BotonCerrar` (la X de las ventanas), `NombreTecnico` (iniciales en círculo con el color del técnico), `EtiquetaFalta` (orden finalizada incompleta) y los estilos de `estilos.js` (`BOTON_ENCABEZADO`, `BOTON_ENCABEZADO_ICONO`, `TARJETA_SECCION`, `TITULO_TARJETA`). `nivelesAviso.js` define los cuatro niveles; el Toast y la campana los usan.
- **Pantallas y piezas rediseñadas:** avisos de toda la app, filtros de Revisión, Finanzas y Reportes (en celular una fila deslizable), Administración e Infraestructura, modales de confirmación, login en PC (dividida suave), tabla y tarjeta de órdenes (bandera antes del código, técnico con avatar y nombre corto, ubicación en un ícono, tipo bajo la etiqueta), píldoras de técnicos (en celular, un resumen plegado con interruptores), Historial, Materiales, Ventas, Envíos al inventario, Detalle de la orden, panel de filtros del Panel principal, campana, toasts, tarjeta de usuario del menú, botones de los encabezados de todos los módulos y reportes en PDF y Word. El logo de Navidad se regeneró más nítido y más grande.
- **Verificado:** la auditoría automática no encuentra fallos de contraste, tamaño mínimo, desborde, áreas táctiles ni nombres en unas 600 combinaciones de pantalla, tamaño y tema, incluida la vista propia de cada rol.

### Auditoría completa del 2026-11-17: lo que falta

**Cómo se hizo:** (1) `npm run auditar:diseno` sobre todos los escenarios (login, panel del administrador y sus modales, módulos, reportes, cada rol en su vista, técnico 1 y 2) en PC, celular y 320 px, en claro y oscuro: 0 fallos. No se pudo abrir Ubicación (módulo apagado) ni el Historial de Infraestructura (necesita el permiso `puedeVerHistorial`). (2) Un barrido del código con lo que sigue sin migrar al estilo nuevo: 117 archivos con `zinc-*` directo (853 usos), 2.634 clases de color directo, 183 fondos y bordes oscuros viejos (`bg-zinc-800/900`, `border-zinc-700/800`), 95 `rounded` chicos, 66 sombras viejas (`shadow-md/lg/xl`), 35 `border-2`, 20 títulos en mayúscula con tracking y 1 texto de 10 px. La herramienta no ve textos cortados ni desalineaciones: lo de abajo sale de mirar las capturas.

**A. Pantallas y modales por rediseñar o revisar a ojo (en orden de prioridad)**

1. **HECHO (2026-11-17) — Formularios de la oficina:** Nueva asignación, Editar orden (sin los botones Llamar/Chat) y Nueva venta ya comparten grupos, etiquetas en minúscula, errores en texto y botones fijos; queda el bloque de reincidencia de Nueva asignación con clases viejas. Texto original: Nueva asignación, Editar orden y Nueva venta (`CreateTicketModal`, `EditTicketModal`, `NuevaVentaModal`): campos de esquinas chicas y etiquetas en mayúscula con "(obligatorio)", distintos de los de Usuarios. Editar orden con los mismos grupos, errores en texto y botones fijos de Nueva asignación.
2. **HECHO (2026-11-17) — Tasa y pagos y Configuración:** Configuración usa el componente `Interruptor` (con su estado y su nota); Tasa y pagos tiene la tarjeta de datos con filas, las pestañas y Formas de pago en tarjetas blancas, todo en el ancho angosto centrado. Falta mover los otros interruptores sueltos (Técnicos, Cierre automático, píldoras de técnicos) al mismo componente. Texto original: la tabla de datos de la Tasa BCV es texto plano y las casillas de Configuración son nativas (pasarlas a interruptores, con el estado y la nota de cada función). Hoy solo están medidas, no rediseñadas. Decidir el ancho: el título va a la izquierda y el contenido centrado y angosto.
3. **HECHO (2026-11-17) — Finanzas por dentro:** pestañas de sección reales (con subrayado, ya no parecen filtros), la tasa dentro de la barra de filtros, el tamaño de letra más discreto, un solo Actualizar (también lee la tasa), nuevo componente `Segmentado` para las dos vistas de Pagos de clientes, nombres de técnico legibles, etiquetas de campos en minúscula y avisos del estilo nuevo. También: el `Calendario` (botones Hoy, Borrar y Cerrar con forma; más ancho en celular), el modal de Anular pago de la orden, el buscador y los filtros de Pagos de clientes en una sola fila (con `Segmentado`) y la vista del administrador. Texto original: `DetalleTecnico` (46 `zinc-*`), `HistorialPagosClientes`, `CobrosEmitidos`, `ResumenPagado`, `Calendario`, el panel de pago y de descuento y sus modales (Pagar, Anular pago). Revisarlo en la vista del rol Finanzas y en la del administrador.
4. **HECHO (2026-11-17) — Pre-finalizar del técnico y flujo de cobro:** pantalla de cobro con las formas de pago de la empresa desplegables, paso Pago con moneda y a. m./p. m. en `Segmentado`, paso de fotos, consulta de cobro del recableado (técnico) y su respuesta (oficina, con `CobroSelector` en estilo nuevo). También: encabezado del Pre-finalizar sin la píldora naranja, etiquetas de los pasos en minúscula (metraje, posteadura, puertos, conectores, NAP, serial) y los pasos de ambas órdenes revisados a ojo. Quedan los avisos con el nombre del técnico en mayúscula (puntos 20 y 21). Texto original: solo se rediseñaron los pasos de visita e instalación; faltan los de fotos, cobro, resultado y el modal "Orden finalizada" en todos sus pasos. Incluye el flujo de cobro (consultar cobro a la oficina y responderlo, en PC y celular).
5. **HECHO (2026-11-18) — Reportes en celular (11 vistas) y sus gráficas:** gráficas (`GraficoColumnas`, `BarrasReporte`, `ResumenEjecutivoView`, `TendenciaMensualView`) migradas a la paleta oficial de marca (rojo de marca `#dc2626` / `dark:#ef4444` para instalaciones/principal y gris cálido `#57534e` / `dark:#d6d3d1` para averías/secundario; en oscuro el gris es más claro que el de los PDF para separarlo del rojo por brillo, no solo por tono); gridlines, tooltips y botones a tokens semánticos; `ReportDetailsView`, `ArchivedSearchResults` (se corrigió tamaño ilegal de 8 px a 11-12 px) y `ActivacionTecnicosView` con tokens semánticos en tablas, badges y fondos. Los textos "Sin técnico" y "Órdenes de cierre" pasaron a minúscula normal. Pistas de medidor y franja de horas en `bg-accent` (visibles sobre la tarjeta) y el interruptor apagado en `bg-muted-foreground/70` con perilla blanca (≥3:1 contra la tarjeta).
6. **HECHO (2026-11-18) — Administración y Promotora:** `AdministracionApp` y `CobroModal` con tokens semánticos (`bg-secondary`, `divide-border`, `hover:bg-accent/50`, `border-border`, `rounded-full` en badges y título "Historial" en minúscula); `ListaInstalaciones` y `TarjetaInstalacion` sin mayúsculas forzadas ni `tracking-wide` en badges y avisos, esquinas chicas reemplazadas por `rounded-boton`, `rounded-md` y `rounded-full`, y comentarios actualizados; `PromotoraApp` con segmentados y contadores migrados a tokens (`bg-muted`, `bg-card`, `bg-accent`); `ResumenPromotores` y `TotalesMes` con tokens; los estados de la lista y de la tarjeta de orden usan el mismo pastel (`ESTILO_ESTADO_PROMOTORA`; se quitó la variante sólida); esquinas chicas restantes a `rounded-md`; **decisión cerrada:** los títulos de los modales van en minúscula normal ("Nueva asignación", "Detalle de la orden", "Pre-finalizar", "Ubicación", etc.; también el visor de fotos); `NuevaVentaModal` con título "Nueva venta" en minúscula normal. Texto original: tarjetas de cobro y `CobroModal`; `ListaInstalaciones` y `TarjetaInstalacion` (mayúsculas con tracking y esquinas chicas), Nueva venta de la promotora.
7. **HECHO (2026-11-18) — Usuarios y Técnicos (modales y formularios internos):** `UsersModal` con tokens semánticos (`bg-secondary`, `divide-border`, `hover:text-foreground`, `border-input focus:ring-primary`, `bg-card border-border`, título de botón "Crear usuario" en minúscula normal, cero clases `zinc-*`); `TechniciansModal` ampliado de `max-w-sm` a `max-w-4xl`, interruptores migrados al componente estándar `<Interruptor />`, cero clases `zinc-*`; `Interruptor.jsx` apagado en `bg-muted-foreground/70` (con `bg-secondary` y borde la perilla blanca casi no se veía); la fila de un usuario deshabilitado ya no usa `opacity-60` (bajaba el texto a 2,9:1): fondo `bg-muted/60` y "· deshabilitado" en negrita.
8. **HECHO (2026-11-18) — Estaciones y Ubicación:** `EstacionesView` completamente limpio (se eliminó el texto de 10 px pasándolo a 11 px PC / 12 px móvil, cero clases `zinc-*`, tokens `bg-secondary`, `bg-muted-foreground`, `ring-ring`); `UbicacionView` preparado y migrado a tokens semánticos (`bg-secondary text-secondary-foreground`, `text-muted-foreground`, `text-sky-700`, `border-border`, `accent-primary`, cero clases `zinc-*`).
9. **HECHO (2026-11-18) — Historial de la orden:** `HistorialTimeline` con tokens (línea y marcadores con anillo, título de 14 px, detalle de 14 px, nada bajo 12 px) en el modal Historial y en el Detalle de la orden. Texto original: `HistorialTimeline` (22 `zinc-*`) y la línea de tiempo en el Detalle de la orden.
10. **HECHO (2026-11-18) — Escáner de serial y `VisorFotos`:** el escáner usa la ventana estándar (encabezado con línea roja, `BotonCerrar`, botones `BOTON`/`BOTON_PRINCIPAL` de 44 px, `Aviso` de error para la cámara y el código rechazado); el visor usa `BotonCerrar`, flechas de 44 px y miniaturas con anillo de marca. Falta ver con una cámara real los estados "código leído" y "ese no es el PON S/N" (la auditoría solo ve la fase de escaneo). Texto original: modales oscuros propios con botones del estilo anterior (`EscanearSerialModal`, 13 `zinc-*`).
11. **Estados vacíos:** hoy son una frase centrada suelta ("Todavía no hay cobros...", "Todavía no hay instalaciones...", "Ninguna orden pagable..."). Hacer un componente `EstadoVacio` (ícono en círculo suave, frase corta y, si hay, la acción) y usarlo en todas las listas.
12. **Aviso de infraestructura en la tarjeta de la orden** (captura del 2026-11-17): título largo en dos líneas, motivo y botón "Resolver" en naranja; revisar el color (hoy se ve naranja y rojizo en oscuro, fuera de los cuatro niveles), el orden y el tamaño. Debería pasar a `Aviso` de atención con el ícono de infraestructura.
13. **Decisiones de diseño abiertas:** el botón "Siguiente" verde de los asistentes frente al rojo de marca; "Estoy en camino" en azul; los títulos de Tasa y pagos y Configuración.
14. **Revisión general de la fuente de la app:** revisar la tipografía completa (familia, pesos, tamaños, interlineado, números y legibilidad en celular y PC) y decidir si se mantiene o se cambia. Hoy se mezclan `font-black`, `font-bold` y `font-semibold` según la pantalla, y quedan textos de 10-11 px y títulos en mayúscula con tracking. Definir una escala única (títulos, subtítulos, cuerpo, etiquetas, cifras) como tokens y aplicarla en todo.
15. **Chip "Sin técnico" (capturas del 2026-11-17 y 2026-11-18):** el chip ámbar "SIN TÉCNICO n" de la barra de técnicos (`TechnicianWorkload`) no se ve bien, especialmente en **vista móvil** donde queda flotando suelto y desalineado arriba del botón desplegable ("Técnicos · n activos · n pendientes"). Además tiene mayúsculas fijas, borde y fondo amarillo propio fuera de los tokens y número pegado. Rediseñarlo e integrarlo armoniosamente: en móvil, evaluar integrarlo dentro del selector desplegable o agruparlo limpiamente con los demás filtros; en PC y celular, pasarlo a tokens semánticos y estilo de píldora estándar.
16. **Calendario del campo de fecha (captura del 2026-11-17, oscuro):** el calendario desplegable de "Programada" queda a la izquierda sin alinearse al ancho del campo, con la cuadrícula suelta y "Hoy"/"Cerrar" sin forma de botón; el campo se ve con borde rojo aun sin error. Revisar `CampoFecha` en claro y oscuro, PC y celular (se usa en Nueva asignación, Editar orden y filtros).
17. **Spinner de carga sin componente global (nota del 2026-11-17):** `Spinner.jsx` solo cubre la rueda dentro de los botones (30 archivos); las pantallas y listas que cargan usan otras ruedas (`animate-spin` suelto en 18 archivos, `RefreshCw` girando, círculos con `border-t-`, textos "Cargando...") con tamaños, colores y posiciones distintos entre módulos. Definir un solo `Cargando` (de botón, de bloque y de pantalla completa, con el color de marca y `role="status"`) y reemplazar todos los usos.
18. **Efectos y transiciones para que la app se sienta fluida y profesional (nota del 2026-11-17):** hoy solo hay animación en PC (modales, menús, avisos, toasts y desplegables, ver `lg:animate-*`) y casi nada en celular. Definir un conjunto corto y consistente: cambio de pestaña y de pantalla (fundido o deslizamiento suave), entrada de listas y tarjetas, estados de botones (presionado, cargando, éxito), abrir y cerrar paneles y acordeones con altura animada, esqueletos de carga en vez de "Cargando...", interruptores y chips con transición de color. Reglas: duraciones de 150 a 250 ms, respetar `prefers-reduced-motion`, no animar lo que se repite mucho (filas de tablas) y cuidar el rendimiento en teléfonos modestos. Va junto con el spinner (17) y el componente de estados vacíos (A11).
19. **Footer de la app (nota del 2026-11-17):** actualizar la versión que muestra el pie ("Asignaciones · v1.0.0", fija desde el inicio) para que siga la real de cada despliegue (la de `package.json` o la fecha y el commit de la compilación, como ya se ve en Configuración) y rediseñar el pie: contenido, tamaño y posición en todas las pantallas y roles, en claro y oscuro.
20. **Textos todo en mayúscula (nota del 2026-11-17):** revisar y corregir todos los casos en que un texto sale con todos los caracteres en mayúscula: títulos de ventanas ("NUEVA VENTA", "EDITAR ORDEN", "ANULAR PAGO DE LA ORDEN"), etiquetas y encabezados de tablas (`uppercase` y `tracking-wide` en decenas de archivos), nombres de técnicos o de clientes guardados en mayúscula, tipos de trabajo y estados, botones y avisos. Decidir la regla (mayúscula inicial normal en todo; mayúsculas solo para siglas, códigos como AS2 e íconos de estado) y aplicarla: con la clase `uppercase` donde solo es presentación, y con `legible()` donde el dato viene guardado en mayúscula (ya se usa en nombres de técnico). Barrer con una búsqueda de `uppercase` y de textos fijos en mayúscula, y mirar las capturas de cada pantalla.
21. **Avisos dentro de la tarjeta de la orden (captura del 2026-11-17):** el aviso de consulta de cobro del recableado ("GERARDO MOLERO pregunta el cobro del recableado (40 m)" con el botón naranja "Responder cobro") se ve apretado en la columna angosta: nombre del técnico en mayúscula partido en varias líneas, botón naranja pesado y de dos líneas, ícono de reloj de arena suelto. El aviso de orden devuelta tiene el mismo problema. Rediseñar los dos (y el aviso de infraestructura, punto 12) como un solo `Aviso` de tarjeta: título corto con el nombre legible, el dato en una línea y un botón de acción del tamaño estándar, que no se parta en la columna angosta de la tabla ni en la tarjeta del celular.
22. **Alineación de columnas con los encabezados en tablas (captura del 2026-11-18):** en la tabla principal de órdenes (`TicketsTable`) y otras tablas, los encabezados de columna (`th`) tienen `text-center` mientras que el contenido de las celdas (`td`) está alineado a la izquierda (`text-left`), lo que hace que los títulos no coincidan con los datos (por ejemplo, NOMBRE, CÉDULA, DIRECCIÓN, FALLA / TRABAJO). Alinear cada encabezado con el contenido de su columna (a la izquierda por defecto; centrado solo en columnas de acciones o íconos).
22. **Orden devuelta con motivo en el dashboard (nota del 2026-11-19, captura):** cuando la oficina devuelve una orden, la tarjeta muestra el aviso rojo "Devuelta por rcova" con el motivo y, debajo, el comentario del técnico (la línea amarilla "cancela 25$ o 22.850,5 bs por instalación y vuelve a cancelar..."): se ven apilados, sin jerarquía, con colores distintos y el texto del técnico cortado. Rediseñar los dos como un solo bloque: quién devolvió y el motivo de la oficina arriba, el comentario del técnico en su propia cita (completo o con "Ver más"), mismo `Aviso`. Va junto con el punto 21.
23. **Selector Tarjetas / Lista en celular (nota del 2026-11-19, captura):** el selector de vista de la Promotora (y de Infraestructura) en celular son solo dos íconos dentro de una pastilla gris: la opción apagada casi no se ve y no dice qué hace cada una. Revisar `Segmentado` con íconos (con texto en celular o con un contraste y una etiqueta accesible claros) y usar el mismo en todos los selectores de vista.
24. **Login, parte superior en oscuro con el logo de Navidad (nota del 2026-11-19, captura):** revisar la cabecera del login: el logo grande con el árbol de Navidad queda pegado a la izquierda sobre un panel negro puro, con mucho espacio vacío entre el logo y el título "Control de Asignaciones", y el título grande queda al borde de la pantalla. Ajustar tamaño y centrado del logo, espacios, margen del título y el fondo (negro puro frente al `fondo` oscuro de la app), en celular y PC, claro y oscuro, con y sin el logo de Navidad (hasta el 2 ene 2027).

**B. Migrar a los tokens de la app (trabajo mecánico, por grupos de archivos)**

Cambiar los `zinc-*`, `bg-zinc-800/900`, `border-2`, `rounded` chico y sombras viejas por los tokens (`bg-card`, `bg-muted`, `text-muted-foreground`, `border-border`, `rounded-campo`, `shadow-card`...). Empezar por los archivos con más usos: `utils/ticketDisplay.jsx` (estilos compartidos de estados y tipos), `TicketsTable`, `TicketsMobileList`, `HistorialTimeline`, `UsersModal`, `finanzas/DetalleTecnico`, `AprobarFinalizarModal`, `CreateTicketModal`, `EstacionesView`, `PromotoraApp`. Los colores de estado con significado (ámbar, verde, rojo, azul) se quedan como están. Ir probando cada grupo con `npm run auditar:diseno`.

**C. Por revisar a ojo (ya hechos, falta mirarlos)**

- Word: abrir un `.docx` de los reportes y confirmar la ficha de marca, la línea roja y las tarjetas (Word no respondió desde la sesión). Pagos detallados y Resumen de pagos de Finanzas en PDF y Word (necesitan pagos en el emulador).
- Toasts de atención e info y su posición en PC; tarjeta de usuario del menú lateral con el menú colapsado y en celular; campana de la oficina con avisos reales; panel de filtros del rol técnico; Detalle de la orden en la vista del técnico y de la promotora.
- Login oscuro y pantallas con datos reales (las capturas usan órdenes de prueba) y `npm run build`.
- Historial de Infraestructura (marcar el permiso `puedeVerHistorial` en Usuarios y agregar un escenario) y los modales que abre cada rol: Nueva venta de la promotora, detalle de un pago en Finanzas, responder un cobro en Administración.

**D. Vista propia de cada rol:** cada rol tiene su pantalla (`EncabezadoSimple`, sus filtros y sus modales) distinta de la del administrador: Finanzas, Administración, Infraestructura, Almacén, Promotora, Usuario y Técnico. Todo lo de arriba hay que comprobarlo también en esas vistas, no solo en la del administrador. La herramienta tiene un escenario por rol y las secciones de Finanzas.

**Despliegue:** nada está subido. La rama `rediseno` está bloqueada para desplegar por el candado; no desplegar hasta que se levante.
