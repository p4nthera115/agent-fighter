import Phaser from 'phaser';
import { VIEW_W } from '../constants';
import { UI } from '../ui';
import { addField } from '../render/field';
import { PixelLabel } from '../render/pixelLabel';
import { music } from '../audio/music';
import { TITLE_THEME } from '../audio/songs';
import { PLAYABLE, ROSTER } from '../roster';
import { thumbKey } from './PreloadScene';
import { isHandheld } from '../settings';

const HOLD_MS = 9000;

/** Small numbers read better as words on a marquee than as digits. */
const WORDS = ['NO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];

function word(value: number): string {
  return WORDS[value] ?? `${value}`;
}

/**
 * The state of the cast, counted rather than written out, so the line cannot
 * go stale the next time a fighter is finished — including the day the last
 * one lands and there is nothing left to apologise for.
 */
function castLine(done: number, left: number): string {
  if (left === 0) return `ALL ${word(done)} ARE FINISHED. THE CAST IS COMPLETE.`;
  const first = `${word(done)} ${done === 1 ? 'FIGHTER IS' : 'FIGHTERS ARE'} FINISHED`;
  const second = left === 1 ? 'ONE IS STILL A DRAWING' : `${word(left)} ARE STILL DRAWINGS`;
  return `${first}. ${second}.`;
}

/**
 * The cast roll: one step of the attract cycle.
 *
 * It states plainly which fighters are playable, because a cabinet that
 * advertises characters it does not have is lying to the player. It counts
 * rather than asserts, so it stays true as the cast fills in.
 */
export class CastScene extends Phaser.Scene {
  private startedAt = 0;

  constructor() {
    super('cast');
  }

  create(): void {
    addField(this);
    // play() is a no-op when the same song is already running, so the theme
    // carries straight across title, cast and the menus without restarting.
    music.setIntensity(1);
    music.play(TITLE_THEME);
    this.startedAt = this.game.loop.time;

    new PixelLabel(this, VIEW_W / 2, 20, 'THE ROSTER', {
      scale: 3,
      color: UI.gold,
      shadow: UI.goldShadow,
      shadowOffset: 1,
      outline: UI.ink,
    }, 'center').setDepth(80);

    const span = 88;
    const left = VIEW_W / 2 - (span * (ROSTER.length - 1)) / 2;

    ROSTER.forEach((entry, i) => {
      const x = Math.round(left + i * span);
      const playable = entry.status === 'playable';

      this.add
        .rectangle(x, 118, 72, 76, playable ? 0x3a40b0 : 0x252a80)
        .setDepth(70)
        .setStrokeStyle(1, playable ? 0xffc24a : 0x4a50c0);

      this.add.image(x, 116, thumbKey(entry.id)).setDepth(72);

      new PixelLabel(this, x, 162, entry.name, {
        scale: 1,
        color: playable ? UI.gold : UI.cream,
        outline: UI.ink,
      }, 'center').setDepth(80);

      new PixelLabel(this, x, 174, entry.role, {
        scale: 1,
        color: UI.cyan,
        outline: UI.ink,
      }, 'center').setDepth(80);

      new PixelLabel(this, x, 190, playable ? 'PLAYABLE' : 'CONCEPT', {
        scale: 1,
        color: playable ? UI.green : UI.dim,
        outline: UI.ink,
      }, 'center').setDepth(80);
    });

    new PixelLabel(
      this,
      VIEW_W / 2,
      218,
      castLine(PLAYABLE.length, ROSTER.length - PLAYABLE.length),
      { scale: 1, color: UI.cream, outline: UI.ink },
      'center',
    ).setDepth(80);

    new PixelLabel(this, VIEW_W / 2, 240, isHandheld() ? 'TAP TO GO BACK' : 'PRESS ANY KEY', {
      scale: 2,
      color: UI.gold,
      outline: UI.ink,
    }, 'center').setDepth(80);

    this.input.keyboard?.once('keydown', () => this.toTitle());
    this.input.once('pointerdown', () => this.toTitle());
  }

  private toTitle(): void {
    this.scene.start('title');
  }

  override update(time: number): void {
    if (time - this.startedAt > HOLD_MS) this.toTitle();
  }
}
