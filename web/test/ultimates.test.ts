import { Match } from '../src/game/combat/match';
import { ULTIMATES, ULTIMATE_LENGTH } from '../src/game/combat/ultimates';
import { emptyInput } from '../src/game/combat/types';
import { RULES } from '../src/game/combat/frameData';
function check(label: string, value: boolean) { if (!value) throw new Error(label); console.log(`PASS ${label}`); }
const idle = () => [emptyInput(), emptyInput()] as const;
function setup(id = 'clawd', player = 0) {
  const m = new Match('A', 'B', [id, id]);
  m.phase = 'fight'; m.fighters[0].x = 450; m.fighters[1].x = 650;
  m.fighters[player].meter = 100; m.drainEvents(); return m;
}
function cast(m: Match, player = 0) { const inputs = [...idle()] as [ReturnType<typeof emptyInput>, ReturnType<typeof emptyInput>]; inputs[player].ultimate = true; m.step(inputs); }
function finish(m: Match, guard = false, victim = 1) {
  for (let t = 0; t < ULTIMATE_LENGTH; t++) {
    const inputs = [...idle()] as [ReturnType<typeof emptyInput>, ReturnType<typeof emptyInput>];
    if (guard) inputs[victim][victim === 1 ? 'right' : 'left'] = true;
    m.step(inputs);
  }
}
for (const [id, def] of Object.entries(ULTIMATES)) for (const player of [0, 1]) {
  const m = setup(id, player); const clock = m.clock; cast(m, player);
  check(`${id} P${player + 1} activation and cost`, !!m.ultimate && m.fighters[player].meter === 0);
  finish(m);
  check(`${id} full damage`, m.fighters[1-player].health === RULES.maxHealth - def.damage.reduce((a: number,b: number) => a+b,0));
  check(`${id} finished and clock paused`, m.ultimate === null && m.clock === clock && m.fighters[player].action === 'free');
  check(`${id} exact hit count`, m.drainEvents().filter(e => e.type === 'ultimateHit').length === def.hits.length);
}
{
 const m = setup(); m.fighters[0].meter = 99; cast(m); check('insufficient meter rejected', !m.ultimate && m.fighters[0].meter === 99);
}
for (const condition of ['air', 'stun', 'intro', 'hitstop']) {
 const m = setup(); if (condition === 'air') m.fighters[0].y = 20; if (condition === 'stun') { m.fighters[0].action = 'hitstun'; m.fighters[0].stunTimer = 20; }
 if (condition === 'intro') m.phase = 'intro'; if (condition === 'hitstop') m.hitstop = 10;
 cast(m); check(`${condition} prevents activation`, !m.ultimate && m.fighters[0].meter === 100);
}
for (const id of Object.keys(ULTIMATES)) {
 const m = setup(id); m.fighters[1].health = 1; cast(m); finish(m, true);
 check(`${id} guard prevents chip KO`, m.fighters[1].health === 1 && m.phase === 'fight');
 const miss = setup(id); miss.fighters[1].x = 1000; cast(miss); finish(miss);
 check(`${id} out of range whiffs`, miss.fighters[1].health === RULES.maxHealth);
 const ko = setup(id); ko.fighters[1].health = 10; cast(ko);
 for (let i=0; i<120; i++) ko.step([...idle()]);
 check(`${id} KO waits for cinematic`, ko.phase === 'fight' && ko.fighters[1].health === 0);
 for (let i=120; i<ULTIMATE_LENGTH; i++) ko.step([...idle()]);
 check(`${id} KO completes round once`, ko.fighters[0].wins === 1 && ko.drainEvents().filter(e=>e.type==='ko').length === 1);
}
{
 const m=setup();m.fighters[1].invuln=5;cast(m);finish(m);check('invulnerability protected during freeze',m.fighters[1].health===RULES.maxHealth);
 const a=setup();cast(a);a.restart();check('restart clears cinematic and meters', !a.ultimate && a.fighters.every(f=>f.meter===0));
 const b=setup();b.fighters[1].meter=100;b.step([{...emptyInput(),ultimate:true},{...emptyInput(),ultimate:true}]);
 check('simultaneous ultimates spend only one meter',b.fighters[0].meter+b.fighters[1].meter===100);
 for(let i=0;i<ULTIMATE_LENGTH;i++)b.step([{...emptyInput(),ultimate:true},emptyInput()]);
 b.fighters[0].meter=100;for(let i=0;i<5;i++)b.step([{...emptyInput(),ultimate:true},emptyInput()]);check('held ultimate cannot repeat',!b.ultimate);
}
console.log('Ultimate simulation checks complete.');

// Exercise the real keyboard mapper without a browser or Phaser.
import { InputManager } from '../src/game/input';
{
 const target = new EventTarget();
 const input = new InputManager(target as unknown as Window);
 const key = (type: string, code: string) => target.dispatchEvent(Object.assign(new Event(type), {code, repeat:false}));
 for(const code of ['Space','KeyI']) {
   key('keydown',code);check(`P1 ${code} ultimate mapping`,input.snapshot()[0].ultimate);
   key('keyup',code);check(`P1 ${code} release clears ultimate`,!input.snapshot()[0].ultimate);
 }
 for(const code of ['Semicolon','Numpad0']) {
   key('keydown',code);check(`P2 ${code} mapping`,input.snapshot()[1].ultimate);
   key('keyup',code);
 }
 key('keydown','Space');target.dispatchEvent(new Event('blur'));check('blur releases ultimate',!input.snapshot()[0].ultimate);
 input.destroy();key('keydown','Space');check('shutdown removes keyboard handlers',!input.snapshot()[0].ultimate);
}
