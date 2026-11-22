(() => {
  const socket = io();
  const $ = id => document.getElementById(id);
  const entry = $('entry'), game = $('game'), stage = $('stage3d');
  let selfId = null, roomId = '', players = new Map(), avatars = new Map(), keys = {}, lastSend = 0;
  let my = {x:600,y:420,facing:1}, joystick = {x:0,y:0}, chatItems = [];
  const W=1200,H=760, SKINS=['#ffe1cf','#f2c29b','#c98c62','#81543f'];
  const DANCES=new Set(['bounce','spin','wave','groove','heart','clap','moonwalk','robot','hiphop','jump','cheer','idle']);
  let scene,camera,renderer,clock,world,orbitAngle=0.0,cameraDistance=24;
  const THREE_OK=!!window.THREE;

  function enter(event,payload){$('entryError').textContent='';socket.emit(event,payload)}
  $('publicBtn').onclick=()=>enter('enterPublic',{name:$('nickname').value});
  $('leaveBtn').onclick=()=>{socket.emit('leave');game.classList.add('hidden');entry.classList.remove('hidden')};
  socket.on('connect',()=>{});
  socket.on('connect_error',e=>{$('entryError').textContent='连接服务器失败，请刷新页面重试。'});
  socket.on('notice',msg=>$('entryError').textContent=msg);
  socket.on('joined',d=>{
    selfId=d.selfId;roomId=d.roomId;entry.classList.add('hidden');game.classList.remove('hidden');
    $('roomTitle').textContent=d.roomName;$('roomCodeLabel').textContent='公开房间';
    if(!THREE_OK){$('entryError').textContent='3D引擎加载失败，请检查网络后刷新。';return}
    try {
      if(!renderer)init3D();
      resize3D();
    } catch (error) {
      console.error('3D scene initialization failed:', error);
      $('entryError').textContent='3D场景启动失败：'+(error?.message||'未知错误');
    }
  });
  socket.on('players',list=>{
    players=new Map(list.map(p=>[p.id,p]));
    const me=players.get(selfId);if(me){my={x:me.x,y:me.y,facing:me.facing};if($('gender'))$('gender').value=me.gender||'female';}
    for(const [id] of avatars)if(!players.has(id))removeAvatar(id);
    for(const p of players.values())ensureAvatar(p);
    renderPlayerList();
  });
  socket.on('roomInfo',d=>$('playerCount').textContent=`${d.count}/${d.max}`);
  socket.on('playerMoved',d=>{const p=players.get(d.id);if(p)Object.assign(p,d)});
  socket.on('playerDance',d=>{const p=players.get(d.id);if(p)p.dance=d.dance});
  socket.on('chat',m=>{chatItems.push(m);chatItems=chatItems.slice(-70);renderChat()});

  function renderPlayerList(){
    $('listCount').textContent=`(${players.size})`;$('playerList').innerHTML='';
    for(const p of players.values()){const el=document.createElement('span');el.className='player-pill';el.textContent=(p.id===selfId?'⭐ ':'')+p.name;$('playerList').appendChild(el)}
  }
  function renderChat(){
    $('chatLog').innerHTML='';for(const m of chatItems){const el=document.createElement('div');el.className='chat-line';const b=document.createElement('b');b.textContent=m.name+'：';el.append(b,document.createTextNode(m.text));$('chatLog').appendChild(el)}$('chatLog').scrollTop=$('chatLog').scrollHeight;
  }
  $('chatForm').onsubmit=e=>{e.preventDefault();const v=$('chatInput').value.trim();if(v){socket.emit('chat',v);$('chatInput').value=''}};
  document.querySelectorAll('[data-dance]').forEach(b=>b.addEventListener('click',()=>{if(DANCES.has(b.dataset.dance))socket.emit('dance',b.dataset.dance)}));
  function sendLook(){socket.emit('customize',{gender:$('gender').value,color:$('outfitColor').value,hair:Number($('hairStyle').value),skin:Number($('skinTone').value),outfit:Number($('outfitStyle').value),accessory:$('accessory').value})}
  ['gender','outfitColor','hairStyle','skinTone','outfitStyle','accessory'].forEach(id=>$(id).addEventListener('change',sendLook));

  // A fully synthesized, original dance beat. Audio starts only after the user's tap (browser autoplay policy).
  let audioCtx=null,master=null,musicTimer=null,step=0,noiseBuffer=null;
  function initAudio(){
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('浏览器不支持网页音乐');
    audioCtx=new AC();master=audioCtx.createGain();master.gain.value=Number($('musicVolume').value)/100*.32;master.connect(audioCtx.destination);
    noiseBuffer=audioCtx.createBuffer(1,audioCtx.sampleRate*.2,audioCtx.sampleRate);const data=noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  }
  function envGain(g,at,peak,decay){g.gain.cancelScheduledValues(at);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(peak,at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+decay)}
  function kick(at){const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.setValueAtTime(125,at);o.frequency.exponentialRampToValueAtTime(42,at+.16);envGain(g,at,.75,.19);o.connect(g);g.connect(master);o.start(at);o.stop(at+.21)}
  function hat(at,open=false){const s=audioCtx.createBufferSource(),f=audioCtx.createBiquadFilter(),g=audioCtx.createGain();s.buffer=noiseBuffer;f.type='highpass';f.frequency.value=7000;envGain(g,at,open?.12:.055,open?.18:.055);s.connect(f);f.connect(g);g.connect(master);s.start(at);s.stop(at+(open?.2:.07))}
  function tone(freq,at,dur,type='sawtooth',vol=.08){const o=audioCtx.createOscillator(),f=audioCtx.createBiquadFilter(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(freq,at);f.type='lowpass';f.frequency.value=type==='sawtooth'?1300:2600;envGain(g,at,vol,dur);o.connect(f);f.connect(g);g.connect(master);o.start(at);o.stop(at+dur+.02)}
  function musicBeat(){if(!audioCtx||audioCtx.state!=='running')return;const at=audioCtx.currentTime+.015,s=step%16; if(s%4===0)kick(at);if(s%2===0)hat(at,s%4===2);if(s%4===2)tone([110,123.47,98,130.81][Math.floor(s/4)],at,.22,'triangle',.13);if([0,4,8,12].includes(s)){const chord=[[220,261.63,329.63],[196,246.94,293.66],[174.61,220,261.63],[196,246.94,311.13]][Math.floor(s/4)];chord.forEach((f,i)=>tone(f,at+i*.012,.34,'sawtooth',.035))}if(s%4===1||s%4===3)tone([440,523.25,392,493.88][Math.floor(s/4)],at,.09,'square',.025);step++}
  $('musicToggle').addEventListener('click',async()=>{
    try{
      if(!audioCtx)initAudio();
      if(audioCtx.state!=='running')await audioCtx.resume();
      if(musicTimer){clearInterval(musicTimer);musicTimer=null;$('musicToggle').textContent='▶ 播放派对音乐';$('musicStatus').textContent='音乐已暂停'}
      else{step=0;musicBeat();musicTimer=setInterval(musicBeat,125);$('musicToggle').textContent='Ⅱ 暂停音乐';$('musicStatus').textContent='原创电子舞曲正在播放 · 音量可调'}
    }catch(e){$('musicStatus').textContent='音乐启动失败：'+(e.message||'请再点播放，并确认手机媒体音量已打开')}
  });
  // iPhone/iPad may suspend WebAudio after screen rotation or app switching.
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&audioCtx&&musicTimer&&audioCtx.state!=='running')audioCtx.resume().catch(()=>{});});
  $('musicVolume').oninput=()=>{if(master)master.gain.setTargetAtTime(Number($('musicVolume').value)/100*.32,audioCtx.currentTime,.04)};

  window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault()});
  window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
  function setupJoystick(){
    const base=$('joystick'),stick=$('stick');let active=false;
    function move(e){const r=base.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy),max=39;if(len>max){dx=dx/len*max;dy=dy/len*max}joystick.x=dx/max;joystick.y=dy/max;stick.style.transform=`translate(${dx}px,${dy}px)`}
    base.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();active=true;base.setPointerCapture(e.pointerId);move(e)});base.addEventListener('pointermove',e=>{if(active){e.preventDefault();move(e)}});
    function end(e){if(e)e.preventDefault();active=false;joystick={x:0,y:0};stick.style.transform='translate(0,0)'}base.addEventListener('pointerup',end);base.addEventListener('pointercancel',end);base.addEventListener('lostpointercapture',end);
  }
  setupJoystick();

  function mat(color,rough=.55,metal=0,emissive=null){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal,emissive:emissive||0,emissiveIntensity:emissive?0.45:0})}
  function box(parent,w,h,d,material,x,y,z,rx=0,ry=0,rz=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);parent.add(m);return m}
  function cylinder(parent,rt,rb,h,material,x,y,z,segments=24){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),material);m.position.set(x,y,z);parent.add(m);return m}
  function sphere(parent,r,material,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(new THREE.SphereGeometry(r,20,14),material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m}
  function labelSprite(text,color='#fff',bg='#321c52'){
    const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.fillStyle=bg;g.globalAlpha=.86;g.beginPath();g.roundRect(8,8,496,112,24);g.fill();g.globalAlpha=1;g.fillStyle=color;g.font='bold 48px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(text,256,66);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));s.scale.set(2.4,.6,1);return s;
  }
  function init3D(){
    scene=new THREE.Scene();scene.background=new THREE.Color('#17102c');scene.fog=new THREE.Fog('#17102c',24,48);
    camera=new THREE.PerspectiveCamera(48,1,.1,100);camera.position.set(0,20,24);camera.lookAt(0,0,0);
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.8));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;stage.appendChild(renderer.domElement);
    clock=new THREE.Clock();world=new THREE.Group();scene.add(world);
    scene.add(new THREE.HemisphereLight('#c8d8ff','#28143e',2.0));const key=new THREE.DirectionalLight('#fff0df',2.4);key.position.set(-7,14,9);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
    const pink=new THREE.PointLight('#ff4eae',32,20);pink.position.set(-8,5,-4);scene.add(pink);const blue=new THREE.PointLight('#4c8dff',34,20);blue.position.set(8,5,-3);scene.add(blue);const gold=new THREE.PointLight('#ffd166',20,12);gold.position.set(-9,4,5);scene.add(gold);
    // Main club floor and raised dance platform
    const floor=box(world,24,.35,15.2,mat('#281b43',.7),0,-.25,0);floor.receiveShadow=true;
    box(world,14,.18,9,mat('#3b245c',.42,.18),0,-.02,0);
    const tileColors=['#8b5cf6','#d946a6','#3b82f6','#f472b6'];
    for(let z=0;z<6;z++)for(let x=0;x<9;x++){const m=box(world,1.48,.035,1.43,mat(tileColors[(x+z)%4],.3,.2,tileColors[(x+z)%4]),(x-4)*1.52,.09,(z-2.5)*1.48);m.material.emissiveIntensity=.12}
    // Back wall, neon trim and pillars
    box(world,24,5,.35,mat('#33204d'),0,2.25,-7.7);box(world,24,.12,.16,mat('#ff70bb',.25,.25,'#ff3d9d'),0,4.35,-7.48);
    for(const x of [-11.2,11.2]){box(world,.55,4.8,.55,mat('#51346e'),x,2.15,-6.9);box(world,.62,.22,.62,mat('#a78bfa',.25,.4,'#a78bfa'),x,4.55,-6.9)}
    // DJ booth
    box(world,4.5,1.15,1.1,mat('#171329'),0,.65,-6.25);box(world,4.2,.16,.95,mat('#a855f7',.3,.35,'#9333ea'),0,1.3,-6.25);
    for(let i=0;i<3;i++){cylinder(world,.23,.23,.08,mat('#d7c5ff',.2,.7),-1.25+i*1.25,1.43,-6.2,32)}
    const dj=labelSprite('DJ PARTY','#fff','#542b77');dj.position.set(0,2.1,-6.3);dj.scale.set(3.2,.8,1);world.add(dj);
    // Speakers
    for(const x of [-9.8,9.8]){box(world,1.1,3,.9,mat('#100e20'),x,1.5,-2.5);for(const y of [.8,2.05]){const s=cylinder(world,.34,.34,.13,mat('#a78bfa',.25,.5,'#7c3aed'),x,y,-1.99,32);s.rotation.x=Math.PI/2;sphere(world,.18,mat('#ff78b7',.25,.4,'#ff4eae'),x,y,-1.88)}}
    // Disco ball and radial hanging beams
    const ball=sphere(world,.72,mat('#d7e5ff',.18,.9),0,5.4,-.7);ball.castShadow=true;
    for(let i=0;i<10;i++){const a=i*Math.PI/5;const shard=box(world,.09,.09,1.25,mat(i%2?'#e9d5ff':'#b8d5ff',.2,.8),Math.cos(a)*.52,5.4,Math.sin(a)*.52);shard.rotation.y=a}
    const spot1=new THREE.SpotLight('#ff58bb',42,28,Math.PI/7,.5,1);spot1.position.set(-7,9,-2);spot1.target.position.set(0,0,0);scene.add(spot1,spot1.target);
    const spot2=new THREE.SpotLight('#58a6ff',42,28,Math.PI/7,.5,1);spot2.position.set(7,9,-2);spot2.target.position.set(0,0,0);scene.add(spot2,spot2.target);
    buildAhouStall();
    buildMiuingStall();
    // Decorative plants
    for(const x of [-10.7,10.7]){cylinder(world,.13,.2,.7,mat('#9b5b42'),x,.35,5.6);for(let i=0;i<5;i++){const leaf=sphere(world,.18,mat('#38b879'),x+Math.cos(i*1.25)*.34,.95+Math.sin(i)*.12,5.6+Math.sin(i*1.25)*.34,1,2.6,.7);leaf.rotation.z=Math.cos(i*1.25)*.6}}
    // Drag to orbit; pinch to zoom on phones/tablets.
    const pointers=new Map();let dragging=false,lastX=0,pinchStart=0,pinchDistance=cameraDistance;
    renderer.domElement.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){dragging=true;lastX=e.clientX}if(pointers.size===2){dragging=false;const a=[...pointers.values()];pinchStart=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);pinchDistance=cameraDistance}renderer.domElement.setPointerCapture(e.pointerId)});
    renderer.domElement.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);cameraDistance=Math.max(11,Math.min(34,pinchDistance-(d-pinchStart)*.035));updateCamera()}else if(dragging){orbitAngle+=(e.clientX-lastX)*.006;lastX=e.clientX;updateCamera()}});
    const stop=e=>{pointers.delete(e.pointerId);if(pointers.size===0)dragging=false;if(pointers.size===1){const only=[...pointers.values()][0];lastX=only.x;dragging=true}};renderer.domElement.addEventListener('pointerup',stop);renderer.domElement.addEventListener('pointercancel',stop);renderer.domElement.addEventListener('lostpointercapture',stop);
    renderer.domElement.addEventListener('wheel',e=>{cameraDistance=Math.max(11,Math.min(34,cameraDistance+e.deltaY*.018));updateCamera();e.preventDefault()},{passive:false});
    $('zoomIn').onclick=()=>{cameraDistance=Math.max(11,cameraDistance-2.5);updateCamera()};$('zoomOut').onclick=()=>{cameraDistance=Math.min(34,cameraDistance+2.5);updateCamera()};$('zoomReset').onclick=()=>{cameraDistance=24;orbitAngle=0;updateCamera()};
    window.addEventListener('resize',resize3D);window.addEventListener('orientationchange',()=>setTimeout(resize3D,250));resize3D();animate();
  }
  function updateCamera(){if(!camera)return;camera.position.set(Math.sin(orbitAngle)*cameraDistance*.72, cameraDistance*.78, Math.cos(orbitAngle)*cameraDistance);camera.lookAt(0,.3,0)}
  function resize3D(){if(!renderer||!camera)return;const w=stage.clientWidth||900,h=stage.clientHeight||570;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
  function buildAhouStall(){
    const g=new THREE.Group();g.position.set(-9.35,0,5.45);world.add(g);
    box(g,3.3,1.1,1.35,mat('#8b4b3a'),0,.62,0);box(g,3.12,.16,1.42,mat('#f4c58a'),0,1.22,0);
    box(g,3.55,.18,1.65,mat('#fff0d5'),0,2.18,0);
    const stripe=['#ff6b8a','#fff0d5','#ff6b8a','#fff0d5','#ff6b8a'];
    for(let i=0;i<5;i++){box(g,.71,.17,1.68,mat(stripe[i]),-1.42+i*.71,2.17,0)}
    for(const x of [-1.52,1.52])for(const z of [-.62,.62])cylinder(g,.055,.055,2.05,mat('#f5d8bd'),x,1.12,z,12);
    box(g,2.85,.64,.12,mat('#fff4df'),0,1.78,-.78);
    const sign=labelSprite('AHOU 四果冰','#7a3150','#fff4df');sign.position.set(0,1.8,-.69);sign.scale.set(2.75,.68,1);g.add(sign);
    const fruitMats=['#ffd166','#ff8fab','#9be7c4'];for(let i=0;i<3;i++){cylinder(g,.34,.38,.15,mat('#e8f5ff'),-.95+i*.95,1.36,.35,24);sphere(g,.27,mat(fruitMats[i]),-.95+i*.95,1.5,.35,1,.35,1);}
    for(let i=0;i<7;i++){const lamp=sphere(g,.07,mat(i%2?'#fff2b2':'#ffdf70',.25,.1,'#ffe38a'),-1.45+i*.48,2.02,.82);lamp.scale.setScalar(.8)}
    const subtitle=labelSprite('冰凉一夏 · 四果冰','#fff','#9a4664');subtitle.position.set(0,.32,1.0);subtitle.scale.set(2.8,.5,1);g.add(subtitle);
  }
  function buildMiuingStall(){
    const g=new THREE.Group();g.position.set(9.25,0,5.35);world.add(g);
    const gold=mat('#d9b36c',.28,.55),cream=mat('#fff1df'),pink=mat('#d94f86'),plum=mat('#4c2348');
    box(g,3.35,1.12,1.35,plum,0,.62,0);box(g,3.5,.16,1.52,gold,0,1.22,0);
    box(g,3.62,.18,1.72,cream,0,2.18,0);
    const stripes=['#d94f86','#fff0df','#d94f86','#fff0df','#d94f86'];for(let i=0;i<5;i++)box(g,.72,.17,1.74,mat(stripes[i]),-1.44+i*.72,2.17,0);
    for(const x of [-1.55,1.55])for(const z of [-.62,.62])cylinder(g,.055,.055,2.05,gold,x,1.12,z,12);
    box(g,3.02,.68,.14,cream,0,1.78,-.79);
    const sign=labelSprite('MIUING 婚介公司','#fff7ed','#8d315d');sign.position.set(0,1.8,-.69);sign.scale.set(2.95,.68,1);g.add(sign);
    const sub=labelSprite('遇见缘分 · 让幸福靠近','#fff','#a84b75');sub.position.set(0,.32,1.0);sub.scale.set(2.95,.5,1);g.add(sub);
    // Elegant heart emblem and couple silhouettes
    const heartMat=mat('#e85d91',.3,.15);const heart=sphere(g,.22,heartMat,0,1.47,.1,1.25,.95,.35);heart.rotation.z=Math.PI/4;
    for(const x of [-.55,.55]){sphere(g,.12,gold,x,1.52,.18);const person=cylinder(g,.13,.19,.42,cream,x,1.22,.18,18);person.rotation.z=x<0?-.12:.12}
    for(let i=0;i<7;i++)sphere(g,.045,mat('#ffe2a8',.25,.2,'#ffe2a8'),-1.48+i*.49,2.02,.83);
  }
  function makeAvatar(p){
    const root=new THREE.Group();root.userData.id=p.id;const body=new THREE.Group();root.add(body);
    const female=p.gender!=='male';
    const shirt=mat(p.color||'#ff8fab',.48),skin=mat(SKINS[p.skin||0]),hair=mat(['#382638','#241f2d','#75433d','#b87942'][p.hair||0]),dark=mat('#25202a'),white=mat('#fff');
    const pants=mat(p.outfit===1&&female?'#34243e':'#27344b'),shoe=mat('#f4e9e2',.35),lip=mat('#b86c72');
    // More natural silhouette: shoulders, tapered waist, hips and separate limbs
    const torso=sphere(body,.39,shirt,0,1.22,0,female?.86:1.05,1.25,.62);
    sphere(body,female?.34:.38,shirt,0,.79,0,female?1.08:1,.72,.67);
    if(female&&p.outfit===1){const skirt=cylinder(body,.49,.28,.48,shirt,0,.69,0,32);skirt.rotation.z=Math.PI;}
    if(p.outfit===2){const stripe=mat('#f8f3ed');box(body,.56,.055,.025,stripe,0,1.35,.245)}
    if(p.outfit===3){const trim=mat('#ffe18a',.28,.55);box(body,.52,.045,.025,trim,0,1.44,.245);sphere(body,.07,trim,0,1.12,.26)}
    cylinder(body,.105,.11,.22,skin,0,1.67,0,18);
    sphere(body,.305,skin,0,1.99,0,.91,1.06,.88);
    // ears, nose, eyes with irises and eyebrows
    for(const side of [-1,1]){sphere(body,.075,skin,side*.30,1.98,0,.65,1,.7);sphere(body,.045,mat('#3c2932'),side*.115,2.04,.264,.8,1,.5);sphere(body,.018,mat('#fff'),side*.12,2.055,.282);box(body,.11,.025,.035,hair,side*.12,2.16,.255,0,0,side*-.12)}
    sphere(body,.035,skin,0,1.96,.285,.7,.7,1.1);
    const smile=new THREE.Mesh(new THREE.TorusGeometry(.075,.012,6,18,Math.PI),lip);smile.position.set(0,1.86,.275);body.add(smile);
    // Hair shapes vary by style and gender
    sphere(body,.322,hair,0,2.19,-.015,1,.58,.96);
    if(p.hair===0){if(female){sphere(body,.12,hair,-.23,2.17,-.04,1,1.8,1);sphere(body,.12,hair,.23,2.17,-.04,1,1.8,1)}else{for(let i=-2;i<=2;i++)sphere(body,.095,hair,i*.12,2.34,.005,1,1.1,1)}}
    if(p.hair===1){for(const x of [-.27,.27]){sphere(body,.13,hair,x,1.85,-.02,1,2.7,1);sphere(body,.11,hair,x,1.52,-.015,1,1.8,1)}sphere(body,.25,hair,0,2.28,-.03,1,.38,1)}
    if(p.hair===2){for(let i=-3;i<=3;i++)sphere(body,.12,hair,i*.09,2.28+Math.cos(i)*.035,.015,1,1,1)}
    if(p.hair===3){for(const x of [-.29,.29]){sphere(body,.17,hair,x,2.32,0,1,1.1,1);cylinder(body,.075,.095,.38,hair,x,2.03,0,14)}}
    // arms and hands
    const arms=[];for(const side of [-1,1]){const pivot=new THREE.Group();pivot.position.set(side*.37,1.47,0);body.add(pivot);const upper=cylinder(pivot,.105,.085,.38,shirt,0,-.2,0,16);upper.rotation.z=side*.08;const fore=cylinder(pivot,.082,.065,.34,skin,0,-.53,.015,16);sphere(pivot,.09,skin,0,-.72,.02);pivot.rotation.z=side*.08;arms.push(pivot)}
    // legs with shoes; gender and outfit affect proportions
    const legs=[];for(const side of [-1,1]){const pivot=new THREE.Group();pivot.position.set(side*(female?.19:.21),.61,0);body.add(pivot);cylinder(pivot,.135,.115,.52,pants,0,-.25,0,16);cylinder(pivot,.09,.085,.22,skin,0,-.60,0,14);sphere(pivot,.13,shoe,0,-.69,.12,1,.62,1.5);legs.push(pivot)}
    // Neckline and small outfit details
    if(female){const necklace=new THREE.Mesh(new THREE.TorusGeometry(.16,.012,6,24,Math.PI),mat('#f4d38a',.25,.6));necklace.position.set(0,1.57,.02);necklace.rotation.x=Math.PI/2;body.add(necklace)}
    let accessory=null;
    if(p.accessory==='crown'){accessory=new THREE.Group();for(let i=0;i<5;i++){const c=cylinder(accessory,.015,.09,.2,mat('#ffd166',.25,.65),-.18+i*.09,.1,0,8);c.position.y=.12;sphere(accessory,.035,mat('#ff5caa',.2,.3,'#ff5caa'),-.18+i*.09,.23,0)}accessory.position.y=2.47;body.add(accessory)}
    if(p.accessory==='glasses'){accessory=new THREE.Group();for(const x of [-.12,.12]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.09,.014,8,20),mat('#29223b',.3,.5));ring.position.set(x,2.04,.29);accessory.add(ring)}box(accessory,.08,.02,.02,dark,0,2.04,.29);body.add(accessory)}
    if(p.accessory==='headphones'){accessory=new THREE.Mesh(new THREE.TorusGeometry(.34,.045,8,24,Math.PI),mat('#ffd166',.3,.5));accessory.position.set(0,2.15,0);accessory.rotation.x=Math.PI/2;body.add(accessory);for(const x of [-.32,.32])sphere(body,.08,mat('#ff8fab'),x,2.0,0)}
    const name=labelSprite(p.name||'舞池玩家',p.id===selfId?'#ffe38a':'#ffffff','#211431');name.position.set(0,3.05,0);name.scale.set(2.0,.5,1);root.add(name);
    root.userData={id:p.id,body,shirt,skin,hair,arms,legs,name,accessoryType:p.accessory||'none',currentLook:''};return root;
  }
  function applyLook(root,p){
    const u=root.userData;if(!u)return;const key=[p.gender,p.color,p.hair,p.skin,p.outfit,p.accessory,p.name].join('|');if(u.currentLook===key)return;u.currentLook=key;
    u.shirt.color.set(p.color||'#ff8fab');u.skin.color.set(SKINS[p.skin||0]);u.hair.color.set(['#50304d','#342b55','#8a4c65','#4d526f'][p.hair||0]);
    // rebuild avatar for full hairstyle/accessory/clothing changes, handled by ensureAvatar
  }
  function ensureAvatar(p){
    const old=avatars.get(p.id);const key=[p.gender,p.color,p.hair,p.skin,p.outfit,p.accessory,p.name].join('|');
    if(old&&old.userData.lookKey===key)return;
    if(old){world.remove(old);disposeGroup(old)}
    const a=makeAvatar(p);a.userData.lookKey=key;world.add(a);avatars.set(p.id,a);
  }
  function disposeGroup(g){g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}})}
  function removeAvatar(id){const a=avatars.get(id);if(a){world.remove(a);disposeGroup(a);avatars.delete(id)}}
  function syncAvatars(t){
    for(const p of players.values()){
      ensureAvatar(p);const a=avatars.get(p.id);if(!a)continue;
      const x=(p.x-600)/50,z=(p.y-380)/50;a.position.set(x,0,z);a.rotation.y=p.facing===-1?Math.PI:0;
      const u=a.userData,b=u.body,phase=t/1000,active=p.dance||'idle';let bob=0,arm=0,leg=0,spin=0;
      if(active==='bounce'){bob=Math.abs(Math.sin(phase*8))*.25;arm=Math.sin(phase*8)*.7;leg=Math.sin(phase*8)*.55}
      else if(active==='jump'){bob=Math.abs(Math.sin(phase*5))*.72;arm=-1.15;leg=Math.sin(phase*5)*.5}
      else if(active==='wave'){arm=Math.sin(phase*5)*.9}
      else if(active==='groove'||active==='hiphop'){bob=Math.sin(phase*5)*.1;arm=Math.sin(phase*6)*.9;leg=Math.sin(phase*5)*.35;b.rotation.y=Math.sin(phase*3)*.22}
      else if(active==='spin'){spin=phase*3.6;bob=.06}
      else if(active==='moonwalk'){bob=.05;leg=Math.sin(phase*6)*.45;arm=.25}
      else if(active==='robot'){arm=Math.round(Math.sin(phase*4))*.55;leg=Math.round(Math.sin(phase*4))*.2}
      else if(active==='clap'){arm=Math.abs(Math.sin(phase*7))*1.0}
      else if(active==='cheer'){arm=-1.2+Math.sin(phase*5)*.18;bob=Math.abs(Math.sin(phase*5))*.18}
      else if(active==='heart'){arm=-.8;bob=.04}
      else{bob=Math.sin(phase*2+p.x)*.025;arm=0;leg=0}
      b.position.y=bob;b.rotation.y=active==='spin'?spin:(active==='groove'||active==='hiphop'?Math.sin(phase*3)*.2:0);
      u.arms[0].rotation.z=-.18-arm;u.arms[1].rotation.z=.18+arm;
      if(active==='clap'){u.arms[0].rotation.z=-.9-Math.abs(Math.sin(phase*7))*.45;u.arms[1].rotation.z=.9+Math.abs(Math.sin(phase*7))*.45}
      if(active==='heart'){u.arms[0].rotation.z=-1.2;u.arms[1].rotation.z=1.2}
      u.legs[0].rotation.x=leg;u.legs[1].rotation.x=-leg;
      const n=u.name;n.position.y=3.05+bob;
    }
  }
  function update(dt){
    let dx=0,dy=0;if(keys.w||keys.arrowup)dy--;if(keys.s||keys.arrowdown)dy++;if(keys.a||keys.arrowleft)dx--;if(keys.d||keys.arrowright)dx++;dx+=joystick.x;dy+=joystick.y;
    const l=Math.hypot(dx,dy);if(l>0){dx/=l;dy/=l;my.x+=dx*230*dt;my.y+=dy*230*dt;if(dx)my.facing=dx>0?1:-1}
    my.x=Math.max(55,Math.min(W-55,my.x));my.y=Math.max(155,Math.min(H-55,my.y));
    if(Date.now()-lastSend>55){socket.emit('move',my);lastSend=Date.now()}
  }
  function animate(){requestAnimationFrame(animate);if(!renderer)return;const dt=Math.min(.05,clock.getDelta()),t=performance.now();if(selfId&&players.has(selfId)){update(dt);const p=players.get(selfId);p.x=my.x;p.y=my.y;p.facing=my.facing}syncAvatars(t);if(world)world.children.forEach(o=>{if(o.geometry&&o.geometry.type==='SphereGeometry'&&o.position.y>5)o.rotation.y+=dt*.35});renderer.render(scene,camera)}
})();
