import Phaser from 'phaser';
import { UI } from '../ui';
import { PixelLabel } from './pixelLabel';

export interface MenuRow {
  id: string;
  label: string;
  /** Right-hand value, for settings rows. */
  value?: () => string;
  /** Called on confirm, or on left/right for a settings row. */
  onSelect?: (direction: 1 | -1 | 0) => void;
  enabled?: boolean;
}

export interface MenuOptions {
  x: number;
  y: number;
  /** Vertical distance between rows. */
  step: number;
  scale: number;
  /** Width of the row, used for the value column and the tap target. */
  width: number;
  depth?: number;
}

/**
 * A keyboard- and pointer-driven list.
 *
 * Every row carries an invisible rectangle behind it so a finger has something
 * to hit; the text itself is far too small to be a touch target.
 */
export class Menu {
  private readonly labels: PixelLabel[] = [];
  private readonly values: (PixelLabel | null)[] = [];
  private readonly hits: Phaser.GameObjects.Rectangle[] = [];
  private index = 0;

  constructor(scene: Phaser.Scene, private readonly rows: MenuRow[], options: MenuOptions) {
    const depth = options.depth ?? 80;
    rows.forEach((row, i) => {
      const y = options.y + i * options.step;

      const hit = scene.add
        .rectangle(options.x - 14, y - 4, options.width + 20, options.step, 0xffffff, 0)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(depth - 1)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.setIndex(i));
      hit.on('pointerdown', () => {
        this.setIndex(i);
        this.confirm();
      });
      this.hits.push(hit);

      this.labels.push(
        new PixelLabel(scene, options.x, y, '', { scale: options.scale, outline: UI.ink })
          .setScrollFactor(0)
          .setDepth(depth),
      );

      this.values.push(
        row.value
          ? new PixelLabel(
              scene,
              options.x + options.width,
              y,
              '',
              { scale: options.scale, outline: UI.ink },
              'right',
            )
              .setScrollFactor(0)
              .setDepth(depth)
          : null,
      );
    });

    this.refresh();
  }

  get selected(): MenuRow {
    return this.rows[this.index];
  }

  move(delta: number): void {
    const count = this.rows.length;
    let next = this.index;
    // Skip over disabled rows rather than letting the cursor stick on one.
    for (let i = 0; i < count; i += 1) {
      next = (next + delta + count) % count;
      if (this.rows[next].enabled !== false) break;
    }
    this.setIndex(next);
  }

  setIndex(value: number): void {
    if (value === this.index || this.rows[value]?.enabled === false) return;
    this.index = value;
    this.refresh();
  }

  confirm(direction: 1 | -1 | 0 = 0): void {
    const row = this.selected;
    if (row.enabled === false) return;
    row.onSelect?.(direction);
    this.refresh();
  }

  /** Repaints labels; cheap, because PixelLabel only redraws on change. */
  refresh(): void {
    this.rows.forEach((row, i) => {
      const active = i === this.index;
      const enabled = row.enabled !== false;
      const colour = !enabled ? UI.dim : active ? UI.gold : UI.idle;
      this.labels[i].setText(`${active ? '>' : ' '} ${row.label}`, { color: colour });
      const value = this.values[i];
      if (value && row.value) {
        value.setText(row.value(), { color: !enabled ? UI.dim : active ? UI.gold : UI.idle });
      }
    });
  }

  destroy(): void {
    for (const label of this.labels) label.destroy();
    for (const value of this.values) value?.destroy();
    for (const hit of this.hits) hit.destroy();
  }
}
