// =============================================================================
// Animations déclaratives façon framer-motion pour Angular.
// Les animations elles-mêmes sont confiées au moteur de framer-motion
// (framer-motion/dom) : mêmes ressorts, mêmes courbes, mêmes durées par défaut.
//
//   <div motion [initial]="{ opacity: 0, y: 10 }" [animate]="{ opacity: 1, y: 0 }" [transition]="{ delay: .2 }">
//   <div motion [initial]="…" [whileInView]="…" [viewport]="{ once: true, margin: '-40px' }">
//   <div motion [whileHover]="{ y: -6 }">
//   @if (open) { <div motion [initial]="…" [animate]="…" [exit]="{ opacity: 0 }"> }   ← sortie animée
//
// Comme <MotionConfig reducedMotion="user">, les transformations deviennent
// instantanées quand le système demande de réduire les animations.
// =============================================================================
import { Directive, ElementRef, afterNextRender, afterEveryRender, effect, inject, input, untracked, DestroyRef, type AnimationCallbackEvent } from '@angular/core';
import { animate as fmAnimate, inView } from 'framer-motion/dom';

export type MotionValue = number | string;
export type MotionTarget = Record<string, MotionValue | MotionValue[]>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MotionTransition = Record<string, any>;
export interface MotionViewport { once?: boolean; margin?: string; amount?: number | 'some' | 'all' }

const TRANSFORM_ORDER = ['x', 'y', 'z', 'scale', 'scaleX', 'scaleY', 'rotate', 'rotateX', 'rotateY', 'rotateZ', 'skew', 'skewX', 'skewY'];
const isTransform = (k: string) => TRANSFORM_ORDER.includes(k);
const unit = (k: string, v: MotionValue) => (typeof v === 'number' ? (k.startsWith('scale') ? `${v}` : k.startsWith('rotate') || k.startsWith('skew') ? `${v}deg` : `${v}px`) : v);
const DEFAULT_VALUE: Record<string, MotionValue> = { opacity: 1, x: 0, y: 0, z: 0, scale: 1, scaleX: 1, scaleY: 1, rotate: 0, rotateX: 0, rotateY: 0, rotateZ: 0, pathLength: 1 };

export const prefersReducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const last = <T,>(v: T | T[]) => (Array.isArray(v) ? v[v.length - 1] : v);

/** Pose immédiatement des valeurs (premier rendu, avant toute animation). */
export function setMotionStyles(el: Element, target: MotionTarget) {
  const style = (el as HTMLElement).style;
  const tf: string[] = [];
  for (const k of TRANSFORM_ORDER) if (k in target) {
    const v = last(target[k]);
    const fn = k === 'x' ? 'translateX' : k === 'y' ? 'translateY' : k === 'z' ? 'translateZ' : k;
    tf.push(`${fn}(${unit(k, v)})`);
  }
  if (tf.length) style.transform = tf.join(' ');
  for (const [k, raw] of Object.entries(target)) {
    if (isTransform(k)) continue;
    const v = last(raw);
    if (k === 'pathLength') {
      el.setAttribute('pathLength', '1');
      el.setAttribute('stroke-dasharray', `${v} 1`);
      el.setAttribute('stroke-dashoffset', '0');
    } else if (k === 'originX' || k === 'originY') continue;
    else style.setProperty(k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`), typeof v === 'number' && !['opacity', 'zIndex'].includes(k) ? `${v}px` : String(v));
  }
}

/** Anime un élément vers une cible (gère height: 'auto' et le mouvement réduit). */
export function motionAnimate(el: Element, target: MotionTarget, transition: MotionTransition = {}, from?: MotionTarget): Promise<void> {
  // les templates Angular ne connaissent pas `Infinity` : `repeat: 1e9` en tient lieu
  if (typeof transition['repeat'] === 'number' && transition['repeat'] >= 1e9) transition = { ...transition, repeat: Infinity };
  const reduced = prefersReducedMotion();
  const kf: MotionTarget = {};
  const instant: MotionTarget = {};
  for (const [k, v] of Object.entries(target)) {
    let val: MotionValue | MotionValue[] = v;
    if (v === 'auto' && (k === 'height' || k === 'width')) {
      const h = el as HTMLElement;
      const prev = h.style[k];
      h.style[k] = 'auto';
      const px = k === 'height' ? h.scrollHeight : h.scrollWidth;
      h.style[k] = prev;
      val = px;
    }
    if (from && k in from && !Array.isArray(val)) val = [last(from[k]), val];
    if (reduced && isTransform(k)) instant[k] = last(val); else kf[k] = val;
  }
  if (Object.keys(instant).length) fmAnimate(el, instant, { duration: 0 });
  if (!Object.keys(kf).length) return Promise.resolve();
  const controls = fmAnimate(el, kf, transition);
  return Promise.resolve(controls.finished).then(() => {
    for (const k of ['height', 'width'] as const) if (target[k] === 'auto') (el as HTMLElement).style[k] = 'auto';
  });
}

@Directive({
  selector: '[motion]',
  host: {
    '(pointerenter)': 'hover(true)',
    '(pointerleave)': 'hover(false)',
    '(animate.leave)': 'leave($event)',
  },
})
export class Motion {
  readonly initial = input<MotionTarget | false | undefined>(undefined);
  readonly animate = input<MotionTarget | undefined>(undefined);
  readonly transition = input<MotionTransition | undefined>(undefined);
  readonly whileInView = input<MotionTarget | undefined>(undefined);
  readonly viewport = input<MotionViewport | undefined>(undefined);
  readonly whileHover = input<MotionTarget | undefined>(undefined);
  readonly hoverTransition = input<MotionTransition | undefined>(undefined);
  readonly exit = input<MotionTarget | undefined>(undefined);

  private el = inject<ElementRef<Element>>(ElementRef).nativeElement;
  private mounted = false;
  private inViewDone = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    // 1er rendu : valeurs initiales posées avant la peinture
    afterNextRender(() => {
      const init = this.initial();
      if (!this.mounted) this.mount(init);
    });
    // la cible « animate » peut changer ensuite : on anime vers la nouvelle cible
    effect(() => {
      const target = this.animate();
      untracked(() => { if (this.mounted && target) motionAnimate(this.el, target, this.transition()); });
    });
    // whileInView
    let stop: VoidFunction | undefined;
    afterNextRender(() => {
      const target = this.whileInView();
      if (!target) return;
      const vp = this.viewport() ?? {};
      stop = inView(this.el, () => {
        if (this.inViewDone && vp.once) return;
        this.inViewDone = true;
        motionAnimate(this.el, target, this.transition(), this.initial() || undefined);
        if (vp.once) { stop?.(); return; }
        return () => { const i = this.initial(); if (i) motionAnimate(this.el, i, this.transition()); };
      }, { margin: vp.margin as never, amount: vp.amount ?? 'some' });
    });
    destroyRef.onDestroy(() => stop?.());
    // pose immédiate de l'état initial (évite un flash avant afterNextRender)
    queueMicrotask(() => { const i = this.initial(); if (i && !this.mounted) setMotionStyles(this.el, i); });
  }

  private mount(init: MotionTarget | false | undefined) {
    this.mounted = true;
    if (init) setMotionStyles(this.el, init);
    const target = this.animate();
    if (target) motionAnimate(this.el, target, this.transition(), init || undefined);
  }

  protected hover(on: boolean) {
    const h = this.whileHover();
    if (!h || prefersReducedMotion()) return;
    const tr = this.hoverTransition() ?? this.transition();
    if (on) { motionAnimate(this.el, h, { ...tr, delay: 0 }); return; }
    const base: MotionTarget = {};
    const a = this.animate() ?? (this.inViewDone ? this.whileInView() : undefined) ?? {};
    for (const k of Object.keys(h)) base[k] = k in a ? last(a[k]) : DEFAULT_VALUE[k] ?? 0;
    motionAnimate(this.el, base, { ...tr, delay: 0 });
  }

  protected leave(e: AnimationCallbackEvent) {
    const x = this.exit();
    if (!x) { e.animationComplete(); return; }
    motionAnimate(this.el, x, { ...this.transition(), delay: 0 }).then(() => e.animationComplete(), () => e.animationComplete());
  }
}

// ---------------------------------------------------------------- layoutId
const layoutRects = new Map<string, { el?: Element; rect?: DOMRect }>();

/**
 * Équivalent de `layoutId` : l'élément portant la même clé glisse de son
 * ancienne position vers la nouvelle (FLIP animé par un ressort).
 */
@Directive({ selector: '[layoutId]' })
export class LayoutId {
  readonly layoutId = input.required<string>();
  readonly layoutTransition = input<MotionTransition>({ type: 'spring', stiffness: 500, damping: 38 });
  private el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    afterNextRender(() => {
      const key = this.layoutId();
      const prev = layoutRects.get(key);
      const from = prev?.el && prev.el.isConnected ? prev.el.getBoundingClientRect() : prev?.rect;
      layoutRects.set(key, { el: this.el });
      if (!from || prefersReducedMotion()) return;
      const to = this.el.getBoundingClientRect();
      if (!to.width || !to.height) return;
      const dx = from.left - to.left, dy = from.top - to.top;
      const sx = from.width / to.width, sy = from.height / to.height;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
      this.el.style.transformOrigin = '0 0';
      fmAnimate(this.el, { x: [dx, 0], y: [dy, 0], scaleX: [sx, 1], scaleY: [sy, 1] }, this.layoutTransition());
    });
    // dernière position connue, relevée après chaque rendu (l'élément peut être détaché avant sa destruction)
    let rect: DOMRect | undefined;
    afterEveryRender({ read: () => { if (this.el.isConnected) rect = this.el.getBoundingClientRect(); } });
    inject(DestroyRef).onDestroy(() => {
      const key = this.layoutId();
      const cur = layoutRects.get(key);
      if (cur?.el === this.el) layoutRects.set(key, { rect: this.el.isConnected ? this.el.getBoundingClientRect() : rect });
    });
  }
}
