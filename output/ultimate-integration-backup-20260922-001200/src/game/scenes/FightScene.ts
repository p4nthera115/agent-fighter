import Phaser from 'phaser';
import {
  MAX_TICKS_PER_FRAME,
  STAGE_W,
  TICK_MS,
  VIEW_H,
  VIEW_W,
} from '../constants';
import { FighterAI } from '../combat/ai';
import { MOVES, RULES } from '../combat/frameData';
import { Match } from '../combat/match';
import type { CombatEvent, InputState } from '../combat/types';
import { InputManager } from '../input';
import { AnimMap } from '../render/animMap';
import { FighterView } from '../render/fighterView';
import { Fx } from '../render/fx';
import { Hud } from '../render/hud';
import { Stage } from '../render/stage';
import { PixelLabel } from '../render/pixelLabel';
import { sfx } from '../audio/sfx';
import { audio } from '../audio/engine';
import { music } from '../audio/music';
import { FIGHT_THEME } from '../audio/songs';
import { UI } from '../ui';
import { saveHiScore } from '../score';
import type { Settings } from '../settings';
import { SETTINGS_KEY } from '../settings';
import { demoPair, fighterArt, matchNames } from '../roster';
import { altTexKey, movesKey, sheetKey, texKey } from './PreloadScene';

export interface FightData {
  mode: 'cpu' | 'versus';
  /** Attract-mode demonstration: both corners are driven by the CPU. */
  demo: boolean;
  /** The two fighters, by roster id. The select screen decides these. */
  picks: [string, string];
}

/** How long the attract demo runs before handing over to the cast roll. */
const DEMO_MS = 26000;
/** Pause after the winner is announced before returning to the title. */
const OUTRO_MS = 4200;

export class FightScene extends Phaser.Scene {
  private match!: Match;
  private ai!: FighterAI;
  private demoAi!: FighterAI;
  private controls!: InputManager;
  private views!: [FighterView, FighterView];
  private fx!: Fx;
  private hud!: Hud;
  private boxes!: Phaser.GameObjects.Graphics;
  private pauseOverlay!: Phaser.GameObjects.Rectangle;
  private pauseLabel!: PixelLabel;
  private pauseHint!: PixelLabel;
  private debugLabel!: PixelLabel;
  private demoLabel!: PixelLabel;

  private accumulator = 0;
  private paused = false;
  private previousPhase = '';
  private settings!: Settings;
  private fight: FightData = { mode: 'cpu', demo: false, picks: ['clawd', 'clawd'] };
  private startedAt = 0;
  private endedAt = 0;
  private leaving = false;

  constructor() {
    super('fight');
  }

  init(data: Partial<FightData>): void {
    const settings = this.registry.get(SETTINGS_KEY) as Settings;
    const demo = data.demo ?? false;
    this.fight = {
      mode: data.mode ?? 'cpu',
      demo,
      picks: data.picks ?? (demo ? demoPair() : settings.picks),
    };
    this.accumulator = 0;
    this.paused = false;
    this.previousPhase = '';
    this.endedAt = 0;
    this.leaving = false;
  }

  create(): void {
    this.settings = this.registry.get(SETTINGS_KEY) as Settings;
    this.startedAt = this.game.loop.time;

    const names = matchNames(this.fight.picks);
    // One bridge per fighter, built from that fighter's own exported JSON.
    const animMaps = this.fight.picks.map(
      (id) => new AnimMap(this.cache.json.get(sheetKey(id)), this.cache.json.get(movesKey(id))),
    );

    this.match = new Match(names[0], names[1]);
    this.ai = new FighterAI(1, this.settings.difficulty);
    this.demoAi = new FighterAI(0, 'rival');
    this.controls = new InputManager();
    this.controls.onCommand = (code) => this.handleCommand(code);
    this.controls.onPlayerInput = () => this.onPlayerInput();

    music.setIntensity(1);
    music.play(FIGHT_THEME);

    new Stage(this);

    // Player two only wears the palette swap in a mirror match. Against a
    // different fighter it would be throwing away the colours that make the
    // two silhouettes tell each other apart.
    const mirror = this.fight.picks[0] === this.fight.picks[1];
    this.views = [
      new FighterView(
        this,
        this.match.fighters[0],
        animMaps[0],
        texKey(this.fight.picks[0]),
        fighterArt(this.fight.picks[0]),
      ),
      new FighterView(
        this,
        this.match.fighters[1],
        animMaps[1],
        mirror ? altTexKey(this.fight.picks[1]) : texKey(this.fight.picks[1]),
        fighterArt(this.fight.picks[1]),
      ),
    ];

    this.fx = new Fx(this);
    this.hud = new Hud(this, this.match);
    this.hud.setNames(names[0], names[1]);

    this.boxes = this.add.graphics().setDepth(55).setVisible(this.settings.showBoxes);
    this.debugLabel = new PixelLabel(this, 8, VIEW_H - 12, '', {
      scale: 1,
      color: UI.cyan,
      outline: UI.ink,
    })
      .setScrollFactor(0)
      .setDepth(105)
      .setVisible(this.settings.showBoxes);

    this.add
      .rectangle(0, VIEW_H - 22, VIEW_W, 22, 0x05070f, 0.88)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(114)
      .setVisible(this.fight.demo);
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.demoLabel = new PixelLabel(
      this,
      VIEW_W / 2,
      VIEW_H - 15,
      coarse ? 'DEMO - TAP TO RETURN' : 'DEMO - PRESS ANY KEY',
      { scale: 2, color: UI.gold, outline: UI.ink },
      'center',
    )
      .setScrollFactor(0)
      .setDepth(115)
      .setVisible(this.fight.demo);

    this.buildPauseOverlay();

    this.cameras.main.setBounds(0, 0, STAGE_W, VIEW_H);
    this.cameras.main.setBackgroundColor(0x05070f);

    this.input.on('pointerdown', () => {
      sfx.unlock();
      if (this.fight.demo) this.leave('title');
    });
    this.game.events.emit('fight:ready', this);
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controls.destroy();
      audio.setMusicDim(false);
      music.setIntensity(1);
    });
  }

  private buildPauseOverlay(): void {
    this.pauseOverlay = this.add
      .rectangle(0, 0, VIEW_W, VIEW_H, 0x0a0d1c, 0.78)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(120)
      .setVisible(false);
    this.pauseLabel = new PixelLabel(this, VIEW_W / 2, VIEW_H / 2 - 22, 'PAUSED', {
      scale: 4,
      color: UI.gold,
      outline: UI.ink,
    }, 'center')
      .setScrollFactor(0)
      .setDepth(121)
      .setVisible(false);
    this.pauseHint = new PixelLabel(
      this,
      VIEW_W / 2,
      VIEW_H / 2 + 16,
      'ESC RESUME    R RESTART    Q QUIT',
      { scale: 1, color: UI.cyan, outline: UI.ink },
      'center',
    )
      .setScrollFactor(0)
      .setDepth(121)
      .setVisible(false);
  }

  private onPlayerInput(): void {
    sfx.unlock();
    if (this.fight.demo) this.leave('title');
  }

  restart(): void {
    this.match.restart();
    this.fx.clear();
    this.controls.releaseAll();
    this.endedAt = 0;
    this.setPaused(false);
  }

  setPaused(value: boolean): void {
    if (this.fight.demo) return;
    this.paused = value;
    this.pauseOverlay.setVisible(value);
    this.pauseLabel.setVisible(value);
    this.pauseHint.setVisible(value);
    if (value) this.controls.releaseAll();
    audio.setMusicDim(value);
  }

  private handleCommand(code: string): void {
    if (this.fight.demo) {
      this.leave('title');
      return;
    }
    switch (code) {
      case 'Escape':
      case 'KeyP':
        this.setPaused(!this.paused);
        break;
      case 'KeyR':
        this.restart();
        break;
      case 'KeyQ':
        this.leave('title');
        break;
      case 'KeyH':
        this.settings.showBoxes = !this.settings.showBoxes;
        this.registry.set(SETTINGS_KEY, { ...this.settings });
        this.boxes.setVisible(this.settings.showBoxes);
        this.debugLabel.setVisible(this.settings.showBoxes);
        break;
      default:
        break;
    }
  }

  /** Records the run and hands control to the next attract step. */
  private leave(target: 'title' | 'cast'): void {
    if (this.leaving) return;
    this.leaving = true;

    if (!this.fight.demo) {
      const scores: [number, number] = [
        this.match.fighters[0].score,
        this.fight.mode === 'versus' ? this.match.fighters[1].score : 0,
      ];
      this.registry.set('scores', scores);
      const best = Math.max(this.registry.get('hiScore') as number, ...scores);
      this.registry.set('hiScore', best);
      saveHiScore(best);
    }

    this.scene.start(target);
  }

  override update(time: number, delta: number): void {
    if (!this.paused) {
      this.accumulator += delta;
      let ticks = 0;
      while (this.accumulator >= TICK_MS && ticks < MAX_TICKS_PER_FRAME) {
        this.match.step(this.collectInputs());
        this.accumulator -= TICK_MS;
        ticks += 1;
      }
      // After a long stall, drop the backlog instead of fast-forwarding.
      if (this.accumulator > TICK_MS * MAX_TICKS_PER_FRAME) this.accumulator = 0;
      this.consumeEvents();
    }

    const frameDelta = this.paused ? 0 : delta;
    const celebrating = this.match.phase === 'roundEnd' || this.match.phase === 'matchEnd';
    this.views[0].update(frameDelta, celebrating && this.match.roundWinner === 0);
    this.views[1].update(frameDelta, celebrating && this.match.roundWinner === 1);
    this.fx.update(frameDelta);
    this.hud.update(frameDelta);
    this.hud.updateHeader(time, this.registry.get('hiScore') as number, this.fight.mode === 'versus');
    this.updateCamera();
    this.updateMusicIntensity();

    if (this.fight.demo) {
      this.demoLabel.setAlpha(0.5 + 0.5 * Math.abs(Math.sin(time / 420)));
      if (time - this.startedAt > DEMO_MS || this.match.phase === 'matchEnd') {
        this.leave('cast');
      }
    } else if (this.match.phase === 'matchEnd') {
      if (this.endedAt === 0) this.endedAt = time;
      else if (time - this.endedAt > OUTRO_MS) this.leave('title');
    }

    if (this.settings.showBoxes) this.drawBoxes();
  }

  /**
   * Lifts the tempo once either fighter is in danger.
   *
   * A cabinet trick: the player hears the round getting desperate before they
   * have finished reading the health bar.
   */
  private updateMusicIntensity(): void {
    if (this.match.phase !== 'fight') return;
    const lowest = Math.min(
      this.match.fighters[0].health,
      this.match.fighters[1].health,
    );
    const danger = lowest / RULES.maxHealth < 0.25;
    music.setIntensity(danger ? 1.09 : 1);
  }

  private collectInputs(): [InputState, InputState] {
    const [p1, p2] = this.controls.snapshot();
    if (this.fight.demo) return [this.demoAi.update(this.match), this.ai.update(this.match)];
    if (this.fight.mode === 'cpu') return [p1, this.ai.update(this.match)];
    return [p1, p2];
  }

  private updateCamera(): void {
    const [a, b] = this.match.fighters;
    const mid = (a.x + b.x) / 2;
    const target = Phaser.Math.Clamp(mid - VIEW_W / 2, 0, STAGE_W - VIEW_W);
    const cam = this.cameras.main;
    cam.scrollX += (target - cam.scrollX) * 0.12;

    const shake = this.match.shake;
    const offsetX = shake > 0.1 ? Phaser.Math.Between(-shake, shake) : 0;
    const offsetY = shake > 0.1 ? Phaser.Math.Between(-shake, shake) : 0;
    cam.setScroll(Math.round(cam.scrollX + offsetX), Math.round(offsetY));
  }

  private consumeEvents(): void {
    for (const event of this.match.drainEvents()) this.reactTo(event);

    const phase = `${this.match.phase}:${this.match.round}`;
    if (phase !== this.previousPhase) {
      if (this.match.phase === 'fight') {
        this.hud.say('FIGHT', '', 800);
        sfx.bell();
      }
      this.previousPhase = phase;
    }
  }

  private reactTo(event: CombatEvent): void {
    switch (event.type) {
      case 'swing':
        sfx.swing(event.move === 'punch' ? 0 : event.move === 'kick' ? 1 : 0.6);
        break;
      case 'hit': {
        const move = MOVES[event.move];
        const power = move.damage / MOVES.uppercut.damage;
        this.fx.hitSpark(event.x, this.yToScreen(event.y), power, event.counter);
        this.fx.damageNumber(event.x, this.yToScreen(event.y) - 18, move.damage, event.counter);
        sfx.hit(power, event.counter);
        break;
      }
      case 'block':
        this.fx.guardSpark(event.x, this.yToScreen(event.y));
        sfx.guard();
        break;
      case 'jump':
        this.fx.dust(this.match.fighters[event.fighter].x, 0.6);
        sfx.jump();
        break;
      case 'land':
        this.fx.dust(this.match.fighters[event.fighter].x, event.hard ? 1.3 : 0.7);
        sfx.land(event.hard);
        break;
      case 'knockdown':
        this.fx.dust(event.x, 1.6);
        sfx.knockdown();
        break;
      case 'ko':
        this.hud.say('K.O.', '', 1600);
        sfx.ko();
        break;
      case 'roundStart':
        this.hud.say(`ROUND ${event.round}`, '', 1200);
        sfx.announce(event.round);
        break;
      case 'roundEnd': {
        if (event.winner === null) {
          this.hud.say('DRAW', '', 1600);
          break;
        }
        const winner = this.match.fighters[event.winner];
        const perfect = winner.health >= RULES.maxHealth;
        this.hud.say(perfect ? 'PERFECT' : 'ROUND WON', winner.name.toUpperCase(), 1800);
        break;
      }
      case 'matchEnd': {
        const winner = event.winner === null ? null : this.match.fighters[event.winner];
        this.hud.say(
          winner ? 'WINNER' : 'DRAW GAME',
          winner ? winner.name.toUpperCase() : '',
          OUTRO_MS,
        );
        // The fanfare needs the field to itself.
        music.stop();
        sfx.victory();
        break;
      }
      default:
        break;
    }
  }

  /** Combat y is measured up from the floor; screen y grows downward. */
  private yToScreen(y: number): number {
    return 236 - y;
  }

  private drawBoxes(): void {
    const g = this.boxes;
    g.clear();

    for (const fighter of this.match.fighters) {
      const push = fighter.pushbox();
      g.lineStyle(1, 0xffe0ad, 0.5);
      g.strokeRect(push.left, this.yToScreen(0) - 118, push.right - push.left, 118);

      const hurt = fighter.hurtbox();
      g.fillStyle(0x3fa9f5, 0.12);
      g.lineStyle(1, 0x8fd8ff, 0.85);
      g.fillRect(hurt.left, this.yToScreen(hurt.top), hurt.right - hurt.left, hurt.top - hurt.bottom);
      g.strokeRect(hurt.left, this.yToScreen(hurt.top), hurt.right - hurt.left, hurt.top - hurt.bottom);

      const hit = fighter.hitbox();
      if (hit) {
        g.fillStyle(0xff3b30, 0.3);
        g.lineStyle(1, 0xff5a4a, 1);
        g.fillRect(hit.left, this.yToScreen(hit.top), hit.right - hit.left, hit.top - hit.bottom);
        g.strokeRect(hit.left, this.yToScreen(hit.top), hit.right - hit.left, hit.top - hit.bottom);
      }
    }

    const [a, b] = this.match.fighters;
    const describe = (f: typeof a) =>
      f.move
        ? `${f.move.id.toUpperCase()} ${f.phase ?? '-'} ${f.moveTick}/${
            f.move.startup + f.move.active + f.move.recovery
          }`
        : f.action.toUpperCase();
    this.debugLabel.setText(
      `P1 ${describe(a)}   P2 ${describe(b)}   GAP ${Math.round(Math.abs(a.x - b.x))}`,
    );
  }

  /** Lets the surrounding page drive player one from on-screen buttons. */
  bindTouchControl(element: HTMLElement, action: keyof InputState): void {
    this.controls.bindTouchButton(element, action);
  }

  /** Wires the panel's joystick to player one. */
  bindStick(element: HTMLElement): void {
    this.controls.bindStick(element);
  }
}
