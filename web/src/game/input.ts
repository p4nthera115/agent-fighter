import { emptyInput } from './combat/types';
import type { InputState } from './combat/types';

type Action = keyof InputState;

/** Two local players on one keyboard, plus a touch pad for player one. */
const BINDINGS: Array<Record<string, Action>> = [
  {
    KeyW: 'up',
    KeyA: 'left',
    KeyS: 'down',
    KeyD: 'right',
    KeyJ: 'punch',
    KeyK: 'kick',
    KeyL: 'uppercut',
    Space: 'ultimate',
    KeyI: 'ultimate',
  },
  {
    ArrowUp: 'up',
    ArrowLeft: 'left',
    ArrowDown: 'down',
    ArrowRight: 'right',
    Numpad1: 'punch',
    Numpad2: 'kick',
    Numpad3: 'uppercut',
    Numpad0: 'ultimate',
    Semicolon: 'ultimate',
    Comma: 'punch',
    Period: 'kick',
    Slash: 'uppercut',
  },
];

/**
 * How far the ball leaves centre, as a fraction of the base radius, and how
 * far a hand has to push before the switch under it closes.
 *
 * The stick is a microswitch stick in a square gate, not an analogue one: it
 * is either centred or hard over, in one of eight directions, so the ball is
 * drawn at the snapped direction rather than wherever the pointer is.
 */
const STICK_THROW = 0.3;
const STICK_DEADZONE = 0.3;

const SWALLOW = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Slash',
]);

export class InputManager {
  private readonly held: [InputState, InputState] = [emptyInput(), emptyInput()];
  private readonly touch: InputState = emptyInput();
  /** Everything bound to the cabinet's own controls, dropped in one go. */
  private readonly panel = new AbortController();
  private stick?: HTMLElement;
  private readonly onKeyDown: (event: KeyboardEvent) => void;
  private readonly onKeyUp: (event: KeyboardEvent) => void;
  private readonly onBlur: () => void;

  /** Raised for keys the game treats as commands rather than fighter input. */
  onCommand?: (code: string) => void;
  /** Raised the first time a human touches any fighter control. */
  onPlayerInput?: () => void;

  constructor(private readonly target: Window = window) {
    this.onKeyDown = (event) => {
      if (event.repeat) return;
      if (SWALLOW.has(event.code)) event.preventDefault();
      if (this.apply(event.code, true)) this.onPlayerInput?.();
      else this.onCommand?.(event.code);
    };
    this.onKeyUp = (event) => {
      this.apply(event.code, false);
    };
    this.onBlur = () => this.releaseAll();

    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  private apply(code: string, value: boolean): boolean {
    let matched = false;
    for (let i = 0; i < BINDINGS.length; i += 1) {
      const action = BINDINGS[i][code];
      if (action) {
        this.held[i][action] = value;
        matched = true;
      }
    }
    if (matched) this.drawStick();
    return matched;
  }

  /**
   * Leans the ball the way player one is holding, whatever moved it.
   *
   * The stick on the panel is the same control as the keys, so a player on
   * the keyboard still sees it move; a stick that sat still while the fighter
   * walked would read as a picture of a stick rather than the control.
   */
  private drawStick(): void {
    const stick = this.stick;
    if (!stick) return;
    const [p1] = this.snapshot();
    const x = (p1.right ? 1 : 0) - (p1.left ? 1 : 0);
    const y = (p1.down ? 1 : 0) - (p1.up ? 1 : 0);
    // A diagonal is the same throw, split across both axes.
    const reach = (stick.clientWidth / 2) * STICK_THROW * (x && y ? Math.SQRT1_2 : 1);
    stick.style.setProperty('--tx', `${x * reach}px`);
    stick.style.setProperty('--ty', `${y * reach}px`);
    stick.classList.toggle('is-held', Boolean(x || y));
  }

  /** Wires an on-screen control to player one. */
  bindTouchButton(element: HTMLElement, action: Action): void {
    const { signal } = this.panel;
    const set = (value: boolean) => (event: Event) => {
      event.preventDefault();
      if (value) this.onPlayerInput?.();
      this.touch[action] = value;
      element.classList.toggle('is-down', value);
      this.drawStick();
    };
    element.addEventListener('pointerdown', set(true), { signal });
    element.addEventListener('pointerup', set(false), { signal });
    element.addEventListener('pointercancel', set(false), { signal });
    element.addEventListener('pointerleave', set(false), { signal });
  }

  /**
   * Wires the panel's joystick to player one.
   *
   * The pointer is captured on the way down, so a hand that slides off the
   * base still holds the direction it is pushing, the way a real stick does.
   */
  bindStick(element: HTMLElement): void {
    const { signal } = this.panel;
    this.stick = element;

    let holding = -1;

    const push = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      const radius = box.width / 2;
      if (radius <= 0) return;
      const dx = (event.clientX - (box.left + radius)) / radius;
      const dy = (event.clientY - (box.top + box.height / 2)) / radius;
      this.touch.left = dx <= -STICK_DEADZONE;
      this.touch.right = dx >= STICK_DEADZONE;
      this.touch.up = dy <= -STICK_DEADZONE;
      this.touch.down = dy >= STICK_DEADZONE;
      this.drawStick();
    };

    const centre = () => {
      holding = -1;
      this.touch.left = false;
      this.touch.right = false;
      this.touch.up = false;
      this.touch.down = false;
      this.drawStick();
    };

    element.addEventListener(
      'pointerdown',
      (event) => {
        event.preventDefault();
        holding = event.pointerId;
        element.setPointerCapture(event.pointerId);
        this.onPlayerInput?.();
        push(event);
      },
      { signal },
    );
    element.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerId === holding) push(event);
      },
      { signal },
    );
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      element.addEventListener(
        type,
        (event) => {
          if ((event as PointerEvent).pointerId === holding) centre();
        },
        { signal },
      );
    }
    element.addEventListener('contextmenu', (event) => event.preventDefault(), { signal });
  }

  snapshot(): [InputState, InputState] {
    const p1 = { ...this.held[0] };
    for (const key of Object.keys(p1) as Action[]) {
      p1[key] = p1[key] || this.touch[key];
    }
    return [p1, { ...this.held[1] }];
  }

  releaseAll(): void {
    for (const state of this.held) {
      for (const key of Object.keys(state) as Action[]) state[key] = false;
    }
    for (const key of Object.keys(this.touch) as Action[]) this.touch[key] = false;
    this.drawStick();
  }

  destroy(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
    // The panel outlives the scene, so its listeners have to go with it or a
    // rematch would leave the last fight's manager still reading the stick.
    this.panel.abort();
  }
}
