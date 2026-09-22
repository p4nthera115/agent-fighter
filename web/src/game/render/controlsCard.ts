import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../constants';
import { UI } from '../ui';
import { PixelLabel } from './pixelLabel';
import { measure } from './font';
import type { DrawTextOptions } from './font';

/** A control and the thing it does, as one row of the card. */
interface Row {
  /** The caps to draw, in the order a hand would find them. */
  keys: string[];
  action: string;
}

const KEYBOARD: { move: Row[]; attack: Row[] } = {
  move: [
    { keys: ['A', 'D'], action: 'WALK' },
    { keys: ['W'], action: 'JUMP' },
    { keys: ['S'], action: 'CROUCH' },
  ],
  attack: [
    { keys: ['J'], action: 'JAB' },
    { keys: ['K'], action: 'ROUNDHOUSE' },
    { keys: ['L'], action: 'RISING CLAW' },
    { keys: ['SPACE'], action: 'ULTIMATE' },
  ],
};

/**
 * The same card for the cabinet's own panel, which has buttons, not keys.
 *
 * A coarse pointer is a thumb, and the stylesheet swaps the stick for the
 * four-way pad there, so the caps name the pad the player can actually see.
 */
const PANEL: { move: Row[]; attack: Row[] } = {
  move: [
    { keys: ['PAD'], action: 'WALK' },
    { keys: ['UP'], action: 'JUMP' },
    { keys: ['DOWN'], action: 'CROUCH' },
  ],
  attack: [
    { keys: ['B'], action: 'JAB' },
    { keys: ['A'], action: 'ROUNDHOUSE' },
    { keys: ['X'], action: 'RISING CLAW' },
    { keys: ['Y'], action: 'ULTIMATE' },
  ],
};

/** Anything the card owns: both label and rectangle answer to these. */
interface Part {
  setVisible(value: boolean): unknown;
  destroy(): void;
}

const PANEL_BOX = { x: 22, y: 16, w: 436, h: 230 } as const;
const CAP_H = 20;
const CAP_PAD = 5;
const CAP_GAP = 4;
const CAP_SCALE = 2;
const ROW_STEP = 26;
const COLUMNS = [40, 250] as const;

export interface ControlsCardOptions {
  /** Player two's keys are only worth the room in a local versus match. */
  versus: boolean;
  /** A coarse pointer means the panel, so the caps name buttons instead. */
  touch: boolean;
}

/**
 * The card a player meets on their first fight: every control, with the key
 * that works it drawn as the cap it sits under on the keyboard.
 *
 * It lives in view space at HUD depth, so the fight camera's zoom and shake
 * leave it alone while the match behind it is held.
 */
export class ControlsCard {
  private readonly parts: Part[] = [];
  private readonly prompt: PixelLabel;
  /** What the prompt says before the bell, and when it is called back up. */
  private readonly prompts: { start: string; resume: string };
  private shown = false;
  private life = 0;

  constructor(private readonly scene: Phaser.Scene, options: ControlsCardOptions) {
    const source = options.touch ? PANEL : KEYBOARD;

    this.keep(
      scene.add
        .rectangle(0, 0, VIEW_W, VIEW_H, 0x05070f, 0.86)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(118),
    );
    this.keep(
      scene.add
        .rectangle(PANEL_BOX.x, PANEL_BOX.y, PANEL_BOX.w, PANEL_BOX.h, 0x0a0d1c, 0.96)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(119)
        .setStrokeStyle(1, 0xffc24a, 0.9),
    );

    this.keep(
      this.label(VIEW_W / 2, 28, 'HOW TO FIGHT', {
        scale: 3,
        color: UI.gold,
        shadow: UI.goldShadow,
        shadowOffset: 1,
        outline: UI.ink,
      }, 'center'),
    );

    this.column(COLUMNS[0], 56, 'MOVE', source.move);
    this.column(COLUMNS[1], 56, 'ATTACK', source.attack);

    const notes = [
      options.touch
        ? 'HOLD THE PAD AWAY FROM YOUR RIVAL TO BLOCK'
        : 'HOLD AWAY FROM YOUR RIVAL TO BLOCK',
      'THE ULTIMATE NEEDS A FULL METER',
    ];
    notes.forEach((text, i) => {
      this.keep(
        this.label(VIEW_W / 2, 172 + i * 12, text, {
          scale: 1,
          color: UI.cyan,
          outline: UI.ink,
        }, 'center'),
      );
    });

    if (options.versus) {
      this.keep(
        this.label(VIEW_W / 2, 196, 'PLAYER TWO - ARROWS MOVE - , . / ATTACK - NUM0 ULTIMATE', {
          scale: 1,
          color: UI.cream,
          outline: UI.ink,
        }, 'center'),
      );
    }

    this.prompts = options.touch
      ? { start: 'TAP TO FIGHT', resume: 'TAP TO RESUME' }
      : { start: 'PRESS ANY KEY TO FIGHT', resume: 'PRESS ANY KEY TO RESUME' };
    this.prompt = this.label(
      VIEW_W / 2,
      options.versus ? 214 : 210,
      this.prompts.start,
      { scale: 2, color: UI.gold, outline: UI.ink },
      'center',
    );
    this.keep(this.prompt);

    this.keep(
      this.label(
        VIEW_W / 2,
        234,
        options.touch ? 'START PAUSES    B BACKS OUT OF A MENU' : 'ESC PAUSE    C CONTROLS    R RESTART',
        { scale: 1, color: UI.dim, outline: UI.ink },
        'center',
      ),
    );

    this.setVisible(false);
  }

  /** Heading plus rows, with the actions lined up past the widest cap. */
  private column(x: number, y: number, heading: string, rows: Row[]): void {
    this.keep(this.label(x, y, heading, { scale: 1, color: UI.cyan, outline: UI.ink }));

    const widest = Math.max(...rows.map((row) => this.rowWidth(row.keys)));
    rows.forEach((row, i) => {
      const centreY = y + 18 + i * ROW_STEP;
      let penX = x;
      for (const key of row.keys) {
        penX += this.cap(penX, centreY, key) + CAP_GAP;
      }
      this.keep(
        this.label(x + widest + 12, centreY - 3, row.action, {
          scale: 1,
          color: UI.cream,
          outline: UI.ink,
        }),
      );
    });
  }

  private rowWidth(keys: string[]): number {
    return keys.reduce((total, key) => total + this.capWidth(key) + CAP_GAP, -CAP_GAP);
  }

  private capWidth(key: string): number {
    return Math.round(measure(key, CAP_SCALE).width) + CAP_PAD * 2;
  }

  /** Draws one key cap and reports how wide it turned out. */
  private cap(x: number, centreY: number, key: string): number {
    const w = this.capWidth(key);
    this.keep(
      this.scene.add
        .rectangle(x, centreY - CAP_H / 2, w, CAP_H, 0x1b2246, 1)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(120)
        .setStrokeStyle(1, 0x8fd8ff, 0.9),
    );
    this.keep(
      this.label(x + w / 2, centreY - 7, key, {
        scale: CAP_SCALE,
        color: UI.white,
        outline: UI.ink,
      }, 'center'),
    );
    return w;
  }

  private label(
    x: number,
    y: number,
    text: string,
    style: DrawTextOptions,
    align: 'left' | 'center' | 'right' = 'left',
  ): PixelLabel {
    return new PixelLabel(this.scene, x, y, text, style, align)
      .setScrollFactor(0)
      .setDepth(121);
  }

  private keep(part: Part): void {
    this.parts.push(part);
  }

  get visible(): boolean {
    return this.shown;
  }

  /** The card called back up mid-round asks to resume, not to start. */
  setResuming(value: boolean): void {
    this.prompt.setText(value ? this.prompts.resume : this.prompts.start);
  }

  setVisible(value: boolean): void {
    this.shown = value;
    for (const part of this.parts) part.setVisible(value);
    if (value) this.life = 0;
  }

  /** Blinks the prompt, the way an arcade screen asks for a coin. */
  update(delta: number): void {
    if (!this.shown) return;
    this.life += delta;
    this.prompt.setAlpha(0.55 + 0.45 * Math.abs(Math.sin(this.life / 380)));
  }

  destroy(): void {
    for (const part of this.parts) part.destroy();
    this.parts.length = 0;
  }
}
