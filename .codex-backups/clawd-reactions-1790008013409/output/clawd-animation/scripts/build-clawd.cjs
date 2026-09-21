// Asset assembly: generated source art -> fixed-grid cels, PNG atlas and layered Aseprite.
// npm install sharp, or set NODE_PATH to a directory containing sharp.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../output/clawd-animation');
const W = 224, H = 160;
const palette = ['080605','35100e','551911','752319','923022','af3c29','c84d33','dd6240','ee7950','fa9564','ffb483','ffe0ad'].map(h => [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)));
const blank = () => Buffer.alloc(W*H*4);
const png = (data,w,h) => sharp(data,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
function nearestColor(r,g,b) {
  let best=palette[0], distance=Infinity;
  for (const c of palette) { const d=(r-c[0])**2+(g-c[1])**2+(b-c[2])**2; if(d<distance){best=c;distance=d;} }
  return best;
}
async function main(){
  const {data,info}=await sharp(path.join(out,'source/clawd-parts-generated.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const seen=new Uint8Array(info.width*info.height), regions=[];
  for(let i=0;i<seen.length;i++){
    if(seen[i]||data[i*4+3]<128)continue;
    const stack=[i];seen[i]=1;let x0=info.width,y0=info.height,x1=0,y1=0,count=0;
    while(stack.length){const p=stack.pop(),x=p%info.width,y=Math.floor(p/info.width);count++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      for(const q of [x>0?p-1:-1,x<info.width-1?p+1:-1,y>0?p-info.width:-1,y<info.height-1?p+info.width:-1]){
        if(q>=0&&!seen[q]&&data[q*4+3]>=128){seen[q]=1;stack.push(q);}
      }
    }
    if(count>1500)regions.push({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1,count});
  }
  assert.equal(regions.length,7,'Source must contain exactly one torso, two hands and four feet');
  regions.sort((a,b)=>b.count-a.count);
  const torso=regions.shift();regions.sort((a,b)=>a.left-b.left);regions.unshift(torso);
  const names=['body','left-hand','right-hand','foot-1','foot-2','foot-3','foot-4'];
  const widths=[126,38,36,24,24,24,24];
  const parts={};
  for(let i=0;i<regions.length;i++){
    const r=regions[i], height=Math.round(r.height*widths[i]/r.width);
    const pixels=await sharp(data,{raw:info}).extract({left:r.left,top:r.top,width:r.width,height:r.height}).resize(widths[i],height,{kernel:'nearest'}).raw().toBuffer();
    for(let k=0;k<pixels.length;k+=4){
      if(pixels[k+3]<128){pixels.fill(0,k,k+4);continue;}
      const c=nearestColor(pixels[k],pixels[k+1],pixels[k+2]);pixels[k]=c[0];pixels[k+1]=c[1];pixels[k+2]=c[2];pixels[k+3]=255;
    }
    if(i===3){ // Far-left foot points outward, as in the approved concept.
      const copy=Buffer.from(pixels);
      for(let y=0;y<height;y++)for(let x=0;x<widths[i];x++){
        const s=(y*widths[i]+widths[i]-1-x)*4;copy.copy(pixels,(y*widths[i]+x)*4,s,s+4);
      }
    }
    parts[names[i]]={data:pixels,w:widths[i],h:height};
    await fs.promises.writeFile(path.join(out,'parts',names[i]+'.png'),await png(pixels,widths[i],height));
  }
  const poses=[
    {tag:'idle',phase:'ready',ms:150,bob:0},
    {tag:'idle',phase:'breathe in',ms:110,bob:-1,guard:-1},
    {tag:'idle',phase:'rise',ms:130,bob:-2,guard:-1},
    {tag:'idle',phase:'hold',ms:180,bob:-2,guard:-2},
    {tag:'idle',phase:'breathe out',ms:130,bob:-1,guard:-1},
    {tag:'idle',phase:'settle',ms:110,bob:0},
    {tag:'punch',phase:'ready',ms:60,bob:0},
    {tag:'punch',phase:'wind-up',ms:83,bob:1,lean:-3,hand:-8,handY:3},
    {tag:'punch',phase:'coil',ms:83,bob:2,lean:-5,hand:-14,handY:5},
    {tag:'punch',phase:'release',ms:33,bob:0,lean:2,hand:10,handY:-3,extension:17},
    {tag:'punch',phase:'contact',ms:83,bob:-1,lean:6,hand:27,handY:-7,extension:40,active:true},
    {tag:'punch',phase:'follow-through',ms:50,bob:0,lean:5,hand:23,handY:-5,extension:32},
    {tag:'punch',phase:'retract',ms:67,bob:1,lean:2,hand:10,handY:0,extension:15},
    {tag:'punch',phase:'recover',ms:100,bob:1,hand:-3,handY:1},
    {tag:'punch',phase:'ready',ms:100,bob:0},
    {tag:'uppercut',phase:'ready',ms:60,bob:0},
    {tag:'uppercut',phase:'dip',ms:83,bob:5,lean:-3,hand:-9,handY:15},
    {tag:'uppercut',phase:'load',ms:100,bob:8,lean:-5,hand:-15,handY:21},
    {tag:'uppercut',phase:'drive',ms:50,bob:2,lean:2,upper:{x:161,y:37,h:38}},
    {tag:'uppercut',phase:'contact',ms:83,bob:-4,lean:5,upper:{x:165,y:8,h:60},active:true},
    {tag:'uppercut',phase:'follow-through',ms:67,bob:-6,lean:4,upper:{x:163,y:3,h:63}},
    {tag:'uppercut',phase:'lower guard',ms:83,bob:-2,lean:2,upper:{x:160,y:28,h:45}},
    {tag:'uppercut',phase:'recover',ms:100,bob:2,hand:-3,handY:5},
    {tag:'uppercut',phase:'ready',ms:100,bob:0},
    {tag:'kick',phase:'ready',ms:60,bob:0},
    {tag:'kick',phase:'shift weight',ms:83,bob:2,lean:-4,guard:-3},
    {tag:'kick',phase:'chamber',ms:100,bob:1,lean:-6,guard:-5,kick:{x:137,y:91,w:33,h:26}},
    {tag:'kick',phase:'extend',ms:50,bob:0,lean:-4,guard:-7,kick:{x:140,y:85,w:52,h:25}},
    {tag:'kick',phase:'contact',ms:100,bob:-2,lean:-6,guard:-8,kick:{x:142,y:78,w:74,h:27},active:true},
    {tag:'kick',phase:'follow-through',ms:67,bob:-1,lean:-5,guard:-6,kick:{x:142,y:80,w:70,h:27}},
    {tag:'kick',phase:'recoil',ms:83,bob:1,lean:-4,guard:-4,kick:{x:137,y:92,w:37,h:25}},
    {tag:'kick',phase:'plant foot',ms:100,bob:2,lean:-2},
    {tag:'kick',phase:'ready',ms:100,bob:0},
  ];
  const rotateCCW=part=>{const rotated=Buffer.alloc(part.data.length);for(let y=0;y<part.h;y++)for(let x=0;x<part.w;x++){const s=(y*part.w+x)*4,d=((part.w-1-x)*part.h+y)*4;part.data.copy(rotated,d,s,s+4);}return {data:rotated,w:part.h,h:part.w};};
  const upFist=rotateCCW(parts['right-hand']), kickFoot=rotateCCW(parts['foot-4']);
  const layerNames=['Foot 1 - outward','Foot 2','Foot 3','Foot 4 - kick','Attack forearm','Body','Left hand','Right hand'];
  const frames=[], layers=[];
  function stamp(target,part,x,y,w=part.w,h=part.h){
    assert(x>=0&&y>=0&&x+w<=W&&y+h<=H,'Cel would clip outside frame');
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
      const s=(Math.floor(yy*part.h/h)*part.w+Math.floor(xx*part.w/w))*4;
      if(part.data[s+3])part.data.copy(target,((y+yy)*W+x+xx)*4,s,s+4);
    }
  }
  for(let i=0;i<poses.length;i++){
    const p=poses[i], bob=p.bob||0, lean=p.lean||0;
    const ls=layerNames.map(blank);
    for(let j=0;j<4;j++){
      if(j===3&&p.kick)stamp(ls[j],kickFoot,p.kick.x,p.kick.y,p.kick.w,p.kick.h);
      else {const rise=p.tag==='uppercut'?Math.min(0,bob):0;stamp(ls[j],parts['foot-'+(j+1)],44+j*31,102+rise,24,34-rise);}
    }
    if(p.extension)stamp(ls[4],parts['right-hand'],151+Math.max(lean,0),61+bob+(p.handY||0),p.extension,23);
    if(p.upper)stamp(ls[4],upFist,p.upper.x+3,p.upper.y+16,24,p.upper.h);
    stamp(ls[5],parts.body,43+lean,18+bob);
    stamp(ls[6],parts['left-hand'],17+Math.round(lean*.4),71+bob+(p.guard||0));
    if(p.upper)stamp(ls[7],upFist,p.upper.x,p.upper.y);
    else stamp(ls[7],parts['right-hand'],157+(p.hand||0),55+bob+(p.handY||0)+(p.guard||0));
    const merged=blank();for(const l of ls)for(let k=0;k<l.length;k+=4)if(l[k+3])l.copy(merged,k,k,k+4);
    frames.push(merged);layers.push(ls);
    await fs.promises.writeFile(path.join(out,'frames',String(i).padStart(2,'0')+'.png'),await png(merged,W,H));
  }
  const cols=5,rows=Math.ceil(poses.length/cols), sheet=Buffer.alloc(W*cols*H*rows*4);
  for(let i=0;i<frames.length;i++)for(let y=0;y<H;y++)frames[i].copy(sheet,((Math.floor(i/cols)*H+y)*W*cols+i%cols*W)*4,y*W*4,(y+1)*W*4);
  const sheetPng=await png(sheet,W*cols,H*rows);
  await fs.promises.writeFile(path.join(out,'clawd-sheet.png'),sheetPng);
  await fs.promises.writeFile(path.join(out,'clawd-master.png'),await png(frames[0],W,H));
  const meta={frames:poses.map((p,i)=>({filename:p.tag+'-'+String(i).padStart(2,'0'),frame:{x:i%cols*W,y:Math.floor(i/cols)*H,w:W,h:H},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:W,h:H},sourceSize:{w:W,h:H},duration:p.ms})),meta:{app:'Clawd sprite assembly',version:'1',image:'clawd-sheet.png',format:'RGBA8888',size:{w:W*cols,h:H*rows},scale:'1',frameTags:[{name:'idle',from:0,to:5,direction:'forward'},{name:'punch',from:6,to:14,direction:'forward'},{name:'uppercut',from:15,to:23,direction:'forward'},{name:'kick',from:24,to:32,direction:'forward'}],slices:[{name:'origin',color:'#000000ff',keys:[{frame:0,bounds:{x:0,y:0,w:W,h:H},pivot:{x:106,y:136}}]}]}};
  fs.writeFileSync(path.join(out,'clawd-sheet.json'),JSON.stringify(meta,null,2));
  fs.writeFileSync(path.join(out,'clawd-moves.json'),JSON.stringify({frameSize:{width:W,height:H},origin:{x:106,y:136},animations:{idle:{loop:true,from:0,to:5},punch:{loop:false,from:6,to:14,next:'idle'},uppercut:{loop:false,from:15,to:23,next:'idle'},kick:{loop:false,from:24,to:32,next:'idle'}},frames:poses.map((p,i)=>({index:i,phase:p.phase,duration:p.ms,active:!!p.active})),note:'Animation timing study, not balanced combat frame data. No gameplay hitboxes assigned.'},null,2));
  // Aseprite's documented binary format: full RGBA cels, editable layers and tags.
  const u16=n=>{const b=Buffer.alloc(2);b.writeUInt16LE(n);return b;};
  const str=s=>Buffer.concat([u16(Buffer.byteLength(s)),Buffer.from(s)]);
  const chunk=(type,payload)=>{const b=Buffer.alloc(6);b.writeUInt32LE(payload.length+6);b.writeUInt16LE(type,4);return Buffer.concat([b,payload]);};
  const firstChunks=layerNames.map(name=>{const b=Buffer.alloc(16);b.writeUInt16LE(3);b[12]=255;return chunk(0x2004,Buffer.concat([b,str(name)]));});
  const palHead=Buffer.alloc(20);palHead.writeUInt32LE(palette.length+1);palHead.writeUInt32LE(palette.length,8);
  firstChunks.push(chunk(0x2019,Buffer.concat([palHead,...[[0,0,0,0],...palette.map(c=>[...c,255])].map(c=>Buffer.from([0,0,...c]))])));
  const tagsHead=Buffer.alloc(10);tagsHead.writeUInt16LE(meta.meta.frameTags.length);
  firstChunks.push(chunk(0x2018,Buffer.concat([tagsHead,...meta.meta.frameTags.map((t,i)=>{const b=Buffer.alloc(17);b.writeUInt16LE(t.from);b.writeUInt16LE(t.to,2);b.writeUInt16LE(i?1:0,5);b[13]=238;b[14]=121;b[15]=80;return Buffer.concat([b,str(t.name)]);})])));
  const slice=Buffer.alloc(12);slice.writeUInt32LE(1);slice.writeUInt32LE(2,4);
  const key=Buffer.alloc(28);key.writeUInt32LE(W,12);key.writeUInt32LE(H,16);key.writeInt32LE(106,20);key.writeInt32LE(136,24);
  firstChunks.push(chunk(0x2022,Buffer.concat([slice,str('origin'),key])));
  const binaryFrames=layers.map((ls,i)=>{
    const chunks=i===0?[...firstChunks]:[];
    ls.forEach((rgba,j)=>{const b=Buffer.alloc(20);b.writeUInt16LE(j);b[6]=255;b.writeUInt16LE(2,7);b.writeUInt16LE(W,16);b.writeUInt16LE(H,18);chunks.push(chunk(0x2005,Buffer.concat([b,zlib.deflateSync(rgba)])));});
    const body=Buffer.concat(chunks),head=Buffer.alloc(16);head.writeUInt32LE(body.length+16);head.writeUInt16LE(0xF1FA,4);head.writeUInt16LE(chunks.length,6);head.writeUInt16LE(poses[i].ms,8);head.writeUInt32LE(chunks.length,12);return Buffer.concat([head,body]);
  });
  const payload=Buffer.concat(binaryFrames),head=Buffer.alloc(128);head.writeUInt32LE(128+payload.length);head.writeUInt16LE(0xA5E0,4);head.writeUInt16LE(poses.length,6);head.writeUInt16LE(W,8);head.writeUInt16LE(H,10);head.writeUInt16LE(32,12);head.writeUInt32LE(1,14);head.writeUInt16LE(100,18);head.writeUInt16LE(palette.length+1,32);head[34]=head[35]=1;
  fs.writeFileSync(path.join(out,'clawd.aseprite'),Buffer.concat([head,payload]));
  // Conservative LibreSprite file: omit slice chunk, zero newer reserved fields.
  const libreFrames=binaryFrames.map((frame,i)=>{
    const chunks=[];let at=16;
    while(at<frame.length){const size=frame.readUInt32LE(at),type=frame.readUInt16LE(at+4);const c=Buffer.from(frame.subarray(at,at+size));
      if(type===0x2018){let q=16;for(let n=0;n<c.readUInt16LE(6);n++){c.fill(0,q+5,q+13);q+=19+c.readUInt16LE(q+17);}}
      if(type!==0x2022)chunks.push(c);at+=size;
    }
    const body=Buffer.concat(chunks),h=Buffer.from(frame.subarray(0,16));h.writeUInt32LE(body.length+16);h.writeUInt16LE(chunks.length,6);h.fill(0,10,16);return Buffer.concat([h,body]);
  });
  const librePayload=Buffer.concat(libreFrames),libreHead=Buffer.from(head);libreHead.writeUInt32LE(librePayload.length+128);libreHead.fill(0,34,128);
  fs.writeFileSync(path.join(out,'clawd.ase'),Buffer.concat([libreHead,librePayload]));
  const preview={...meta,poses,palette:palette.map(c=>'#'+c.map(n=>n.toString(16).padStart(2,'0')).join('')),image:'data:image/png;base64,'+sheetPng.toString('base64')};
  fs.writeFileSync(path.join(out,'preview-data.js'),'window.CLAWD_DATA = '+JSON.stringify(preview)+';\n');
  fs.writeFileSync(path.join(out,'source/assembly.json'),JSON.stringify({regions,names,widths,poses,palette,canvas:{w:W,h:H}},null,2));
  console.log(`Created ${poses.length} frames, 8 editable layers, 12 opaque colors + transparency.`);
  console.log('Parts:',Object.fromEntries(Object.entries(parts).map(([k,v])=>[k,[v.w,v.h]])));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
