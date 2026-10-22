import { useLayoutEffect, useRef } from 'react';
import { esPreFinalizada, nuevasPreFinalizadas } from '../utils/preFinalizadas';

const COLOR_POR_APROBAR = 'rgb(59 130 246 / 0.45)';
const DESTELLO_MS = 1800;
const ES_PC = '(min-width: 1024px)';
const SIN_MOVIMIENTO = '(prefers-reduced-motion: reduce)';

// Solo en PC: cuando una orden queda pre-finalizada mientras se mira la tabla, su fila sube desde donde estaba hasta arriba, deslizándose, y las demás bajan para
// hacerle sitio; al llegar destella en azul (el color de "por aprobar"). Es la técnica FLIP: se anotan las posiciones de las filas en cada pintado y, cuando sube una,
// cada fila que cambió de lugar se anima desde su posición anterior hasta la nueva. No anima al abrir la app, al buscar, filtrar u ordenar, ni las órdenes que llegan nuevas.
//   cuerpo: ref del <tbody>; sus filas llevan data-fila={id}. `tickets`: la lista que pinta la tabla, en su orden.
export function useDeslizarPreFinalizadas(cuerpo, tickets) {
  const previas = useRef(null); // Map id -> { top, pre } de la última vez que se pintó

  useLayoutEffect(() => {
    const tbody = cuerpo.current;
    if (!tbody || typeof window === 'undefined' || !window.matchMedia(ES_PC).matches) { previas.current = null; return; }
    const filas = new Map([...tbody.querySelectorAll('tr[data-fila]')].map((tr) => [tr.dataset.fila, tr]));
    const antes = previas.current;

    const suben = antes ? nuevasPreFinalizadas(new Map([...antes].map(([id, v]) => [id, v.pre])), tickets) : [];
    if (suben.length > 0) {
      const sinMovimiento = window.matchMedia(SIN_MOVIMIENTO).matches;
      filas.forEach((tr, id) => {
        const previa = antes.get(id);
        if (!previa) return;
        const delta = previa.top - tr.offsetTop;
        if (delta !== 0 && !sinMovimiento) {
          // La que sube va por encima de las que bajan.
          if (suben.includes(id)) { tr.style.position = 'relative'; tr.style.zIndex = '2'; }
          const movimiento = tr.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], { duration: Math.min(700, 350 + Math.abs(delta) / 6), easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
          movimiento.onfinish = movimiento.oncancel = () => { tr.style.position = ''; tr.style.zIndex = ''; };
        }
        if (suben.includes(id)) tr.animate([{ backgroundColor: COLOR_POR_APROBAR }, {}], { duration: DESTELLO_MS, easing: 'ease-out' });
      });
    }

    const pre = new Map(tickets.map((t) => [t.id, esPreFinalizada(t)]));
    previas.current = new Map([...filas].map(([id, tr]) => [id, { top: tr.offsetTop, pre: pre.get(id) === true }]));
  });
}
