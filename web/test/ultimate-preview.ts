/** Development-only fixture. Vite's production build does not include this page. */
import { createGame } from '../src/game';
import { DEFAULT_SETTINGS } from '../src/game/settings';
import type { FightScene } from '../src/game/scenes/FightScene';
import type { Match } from '../src/game/combat/match';
import { emptyInput } from '../src/game/combat/types';
const byId = (id: string) => document.getElementById(id)!;
const game = createGame({mount:byId('mount'),screen:byId('screen'),frame:byId('frame'),area:byId('area')}, {...DEFAULT_SETTINGS, mode:'versus', crt:false, sound:false, music:false});
// Access private fields only inside the isolated QA fixture, not the product UI.
type Inspection = {match:Match;accumulator:number;previousPhase:string};
let fight: FightScene;
const status = () => {
 const m=(fight as unknown as Inspection).match;
 byId('status').textContent=JSON.stringify({ultimate:m.ultimate,health:m.fighters.map(f=>f.health),meter:m.fighters.map(f=>f.meter),phase:m.phase,zoom:fight.cameras.main.zoom,clock:m.clock,images:fight.children.list.filter(o=>o.type==='Sprite' && (o as Phaser.GameObjects.Sprite).visible).map(o=>{const s=o as Phaser.GameObjects.Sprite;return {key:s.texture.key,frame:s.frame.name,x:s.x,y:s.y};})},null,2);
};
function run(ticks: number, play = false) {
 const id=(byId('fighter') as HTMLSelectElement).value;
 const side=Number((byId('side') as HTMLSelectElement).value);
 game.scene.getScenes(true).forEach(s=>s.scene.stop());
 game.events.once('fight:ready',(scene:FightScene)=>{
  fight=scene;
  const state=scene as unknown as Inspection,m=state.match;
  m.phase='fight';m.fighters[0].x=450;m.fighters[1].x=650;m.fighters[side].meter=100;
  m.drainEvents();state.previousPhase = 'fight:1';
  const inputs:[ReturnType<typeof emptyInput>,ReturnType<typeof emptyInput>]=[emptyInput(),emptyInput()]; inputs[side].ultimate=true;
  m.step(inputs);inputs[side].ultimate=false;
  for(let i=0;i<ticks;i++)m.step(inputs);
  state.accumulator=0;
  scene.update(game.loop.time,0);
  if(!play) {
    // Put the camera at its normal midpoint before inspecting a fixed cel.
    scene.cameras.main.centerOn(550, 135);
    scene.update(game.loop.time, 0);
    scene.scene.pause();
  }
  status();
 });
 game.scene.start('fight',{mode:'versus',demo:false,picks:[id,id]});
}
byId('cutin').onclick=()=>run(18);
byId('impact').onclick=()=>run(104);
byId('finish').onclick=()=>run(144);
byId('play').onclick=()=>run(0,true);
byId('restart').onclick=()=>{fight.scene.resume();fight.restart();fight.update(game.loop.time,0);fight.scene.pause();status();};
// Buttons become useful after the normal asset loader completes.
game.events.once('ready',()=>{byId('status').textContent='Select a fighter and pose after loading.';});
