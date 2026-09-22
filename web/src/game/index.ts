import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from './constants';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { CastScene } from './scenes/CastScene';
import { SelectScene } from './scenes/SelectScene';
import { InfoScene } from './scenes/InfoScene';
import { VersusScene } from './scenes/VersusScene';
import { FightScene } from './scenes/FightScene';
import { TUBE_WARP, TubeWarpPipeline, warpCamera } from './render/tube';
import { SETTINGS_KEY } from './settings';
import type { Settings } from './settings';

/**
 * Creates the game with integer scaling on desktop and proportional scaling
 * inside a 3:2 LCD on handhelds.
 *
 * Desktop glass fits the canvas exactly. The handheld LCD adds letterboxing
 * while its centered stage mount preserves the native game aspect ratio.
 */
export interface CabinetElements {
  /** Where Phaser puts the canvas. */
  mount: HTMLElement;
  /** The glass: sized to an exact multiple of the internal buffer. */
  screen: HTMLElement;
  /** The bezel, whose border width is subtracted from the available area. */
  frame: HTMLElement;
  /** The region the whole cabinet is allowed to fill. */
  area: HTMLElement;
}

export function createGame(elements: CabinetElements, settings: Settings): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: elements.mount,
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: '#05070f',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    // All sound goes through our own Web Audio graph in src/game/audio, so
    // Phaser's sound manager would only stand up a second, unused context.
    audio: { noAudio: true },
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    pipeline: { [TUBE_WARP]: TubeWarpPipeline } as unknown as Phaser.Types.Core.PipelineConfig,
    scene: [PreloadScene, TitleScene, CastScene, SelectScene, InfoScene, VersusScene, FightScene],
  });

  game.registry.set(SETTINGS_KEY, settings);

  // The tube's curvature belongs to the same switch as the rest of the glass.
  const curved = () => (game.registry.get(SETTINGS_KEY) as Settings).crt;

  // Scene cameras are rebuilt on every start, so the warp is reapplied each
  // time one is created rather than once at boot.
  game.events.once(Phaser.Core.Events.READY, () => {
    for (const scene of game.scene.scenes) {
      scene.events.on(Phaser.Scenes.Events.CREATE, () => warpCamera(scene.cameras.main, curved()));
    }
  });

  game.events.on('cabinet:crt', (on: boolean) => {
    for (const scene of game.scene.getScenes(true)) warpCamera(scene.cameras.main, on);
  });

  const { screen, frame, area } = elements;

  /** The largest whole magnification that fits inside the case as it stands. */
  const measure = (): number => {
    const areaStyle = getComputedStyle(area);
    const bezel = Number.parseFloat(getComputedStyle(frame).borderTopWidth) || 0;
    const availableW =
      area.clientWidth -
      Number.parseFloat(areaStyle.paddingLeft) -
      Number.parseFloat(areaStyle.paddingRight) -
      bezel * 2;
    const availableH =
      area.clientHeight -
      Number.parseFloat(areaStyle.paddingTop) -
      Number.parseFloat(areaStyle.paddingBottom) -
      bezel * 2;
    if (availableW < 1 || availableH < 1) return 0;

    const handheld = areaStyle.getPropertyValue('--handheld').trim() === '1';
    const displayHeight = handheld ? VIEW_W * 2 / 3 : VIEW_H;
    const raw = Math.min(availableW / VIEW_W, availableH / displayHeight);
    // Whole-number zoom wherever there is room for it. Below 1:1 the screen is
    // narrower than the buffer, so a fraction is the only way to show it all.
    return handheld ? raw : raw >= 1 ? Math.floor(raw) : Math.max(0.2, raw);
  };

  /**
   * Picks how much case to wear.
   *
   * The marquee, the hood and the control panel all eat into the picture, and
   * a magnification is a whole number: a case that is twenty pixels too deep
   * costs a step and shows half the picture it could have. So both cases are
   * measured and the roomy one is kept only when it is free; where it is not,
   * the machine gives way and everything goes to its floor size.
   */
  const dress = () => {
    const roomy = measure();
    document.body.classList.add('cab-tight');
    const tight = measure();
    document.body.classList.toggle('cab-tight', tight > roomy);
  };

  let dressedFor = '';

  const fit = () => {
    const viewport = `${window.innerWidth}x${window.innerHeight}`;
    if (viewport !== dressedFor) {
      dressedFor = viewport;
      document.body.classList.remove('cab-tight');
      dress();
    }

    const zoom = measure();
    if (zoom <= 0) return;

    const handheld = getComputedStyle(area).getPropertyValue('--handheld').trim() === '1';
    const width = Math.floor(VIEW_W * zoom);
    screen.style.setProperty('--screen-w', `${width}px`);
    screen.style.setProperty('--screen-h', `${width * (handheld ? 2 / 3 : VIEW_H / VIEW_W)}px`);
    screen.style.setProperty('--zoom', `${zoom}`);

    // Scanlines and an aperture grille only mean anything when one art pixel
    // covers several screen pixels. Below that they are just a dark filter.
    screen.style.setProperty('--scan', zoom >= 3 ? '0.30' : zoom >= 2 ? '0.17' : '0');
    screen.style.setProperty('--grille', zoom >= 3 ? '0.10' : '0');

    game.scale.setZoom(zoom);
    game.scale.refresh();
  };

  const observer = new ResizeObserver(fit);
  observer.observe(area);
  window.addEventListener('resize', fit);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    observer.disconnect();
    window.removeEventListener('resize', fit);
  });
  fit();

  return game;
}
