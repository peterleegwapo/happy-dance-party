const socket = io();
const $ = id => document.getElementById(id);
const entry = $("entry"), game = $("game"), canvas = $("stage"), ctx = canvas.getContext("2d");
let selfId = null, roomId = "", roomPrivate = false, players = new Map(), keys = {}, lastSend = 0;
let my = {x:600,y:420,facing:1}, joystick = {x:0,y:0}, chatItems = [];
const W=1200,H=760;
const colors=["#ff8fab","#8ecae6","#b8e0a5","#cdb4db","#ffd166","#f4a261"];
function enter(event, payload){ $("entryError").textContent=""; socket.emit(event,payload); }
$("publicBtn").onclick=()=>enter("enterPublic",{name:$("nickname").value});
$("createBtn").onclick=()=>enter("createPrivate",{name:$("nickname").value,roomName:$("roomName").value});
$("joinBtn").onclick=()=>enter("joinPrivate",{name:$("nickname").value,code:$("roomCode").value});
$("leaveBtn").onclick=()=>{socket.emit("leave");game.classList.add("hidden");entry.classList.remove("hidden");};
$("copyCode").onclick=async()=>{if(!roomPrivate)return alert("公开大厅不需要房间码");try{await navigator.clipboard.writeText(roomId);$("copyCode").textContent="已复制！";setTimeout(()=>$("copyCode").textContent="复制房间码",1500)}catch(e){prompt("复制房间码：",roomId)}};
socket.on("connect",()=>{});
socket.on("notice",msg=>$("entryError").textContent=msg);
socket.on("joined",d=>{selfId=d.selfId;roomId=d.roomId;roomPrivate=d.private;entry.classList.add("hidden");game.classList.remove("hidden");$("roomTitle").textContent=d.roomName;$("roomCodeLabel").textContent=d.private?"房间码："+d.roomId:"公开房间";$("copyCode").style.display=d.private?"block":"none";});
socket.on("players",list=>{players=new Map(list.map(p=>[p.id,p]));const me=players.get(selfId);if(me)my={x:me.x,y:me.y,facing:me.facing};renderPlayerList();});
socket.on("roomInfo",d=>$("playerCount").textContent=`${d.count}/${d.max}`);
socket.on("playerMoved",d=>{const p=players.get(d.id);if(p)Object.assign(p,d)});
socket.on("playerDance",d=>{const p=players.get(d.id);if(p)p.dance=d.dance});
socket.on("chat",m=>{chatItems.push(m);chatItems=chatItems.slice(-70);renderChat()});
function renderPlayerList(){$("listCount").textContent=`(${players.size})`;$("playerList").innerHTML="";for(const p of players.values()){const el=document.createElement("span");el.className="player-pill";el.textContent=(p.id===selfId?"⭐ ":"")+p.name;$("playerList").appendChild(el)}}
function renderChat(){$("chatLog").innerHTML="";for(const m of chatItems){const el=document.createElement("div");el.className="chat-line";const b=document.createElement("b");b.textContent=m.name+"：";el.append(b,document.createTextNode(m.text));$("chatLog").appendChild(el)}$("chatLog").scrollTop=$("chatLog").scrollHeight}
$("chatForm").onsubmit=e=>{e.preventDefault();const v=$("chatInput").value.trim();if(v){socket.emit("chat",v);$("chatInput").value=""}};
document.querySelectorAll("[data-dance]").forEach(b=>b.addEventListener("click",()=>socket.emit("dance",b.dataset.dance)));
window.addEventListener("keydown",e=>{keys[e.key.toLowerCase()]=true;if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault()});
window.addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
function setupJoystick(){const base=$("joystick"),stick=$("stick");if(!base)return;let active=false;function move(e){const r=base.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy),max=34;if(len>max){dx=dx/len*max;dy=dy/len*max}joystick.x=dx/max;joystick.y=dy/max;stick.style.transform=`translate(${dx}px,${dy}px)`}base.addEventListener("pointerdown",e=>{active=true;base.setPointerCapture(e.pointerId);move(e)});base.addEventListener("pointermove",e=>{if(active)move(e)});function end(){active=false;joystick={x:0,y:0};stick.style.transform="translate(0,0)"}base.addEventListener("pointerup",end);base.addEventListener("pointercancel",end)}
setupJoystick();
function update(dt){let dx=0,dy=0;if(keys.w||keys.arrowup)dy--;if(keys.s||keys.arrowdown)dy++;if(keys.a||keys.arrowleft)dx--;if(keys.d||keys.arrowright)dx++;dx+=joystick.x;dy+=joystick.y;const l=Math.hypot(dx,dy);if(l>0){dx/=l;dy/=l;my.x+=dx*230*dt;my.y+=dy*230*dt;if(dx)my.facing=dx>0?1:-1;}my.x=Math.max(55,Math.min(W-55,my.x));my.y=Math.max(155,Math.min(H-55,my.y));if(Date.now()-lastSend>45){socket.emit("move",my);lastSend=Date.now()}}
function rounded(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function drawRoom(t){
 ctx.clearRect(0,0,W,H);
 const grad=ctx.createLinearGradient(0,0,W,H);grad.addColorStop(0,"#332052");grad.addColorStop(1,"#1b1639");ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
 // wall and floor
 rounded(24,22,W-48,H-48,28,"#493061");rounded(38,36,W-76,H-88,22,"#35234e");
 ctx.strokeStyle="#a66bd455";ctx.lineWidth=3;ctx.strokeRect(48,48,W-96,H-112);
 // wall neon
 ctx.shadowBlur=22;ctx.shadowColor="#ff69a9";ctx.strokeStyle="#ff79b5";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(120,95);ctx.lineTo(1080,95);ctx.stroke();ctx.shadowBlur=0;
 ctx.fillStyle="#ffe1f0";ctx.font="bold 25px system-ui";ctx.textAlign="center";ctx.fillText("✦ HAPPY DANCE CLUB ✦",600,80);
 // disco floor
 rounded(260,190,680,430,25,"#251b45");
 for(let y=0;y<8;y++)for(let x=0;x<12;x++){let pulse=(Math.sin(t/350+x*.8+y*.6)+1)/2;ctx.fillStyle=`rgba(${140+Math.floor(pulse*90)},${65+Math.floor(pulse*65)},${190+Math.floor(pulse*50)},${.16+pulse*.22})`;ctx.fillRect(275+x*55,205+y*50,51,46)}
 // DJ booth
 rounded(470,112,260,65,15,"#17142d");rounded(490,126,220,35,8,"#754b99");ctx.fillStyle="#fff";ctx.font="bold 17px system-ui";ctx.fillText("🎧 DJ PARTY",600,150);
 // speakers
 for(const x of [105,1000]){rounded(x,240,78,170,12,"#17152b");for(let y of [275,355]){ctx.beginPath();ctx.arc(x+39,y,24,0,Math.PI*2);ctx.fillStyle="#6d4a91";ctx.fill();ctx.beginPath();ctx.arc(x+39,y,12,0,Math.PI*2);ctx.fillStyle="#ff7db5";ctx.fill()}}
 // plants and decor
 ctx.font="34px serif";ctx.fillText("🌴",115,555);ctx.fillText("🌴",1055,555);ctx.fillText("✨",180,180);ctx.fillText("✨",1020,180);
 // disco ball
 ctx.shadowBlur=30;ctx.shadowColor="#a78bfa";ctx.beginPath();ctx.arc(600,185,22,0,Math.PI*2);ctx.fillStyle="#d9c5ff";ctx.fill();ctx.shadowBlur=0;
}
function drawAvatar(p,t){
 const bob=p.dance==="idle"?Math.sin(t/400+p.x)*2:Math.sin(t/85+p.x)*7;
 const x=p.x,y=p.y+bob,scale=1;
 ctx.save();ctx.translate(x,y);ctx.scale(p.facing||1,1);
 // shadow
 ctx.fillStyle="#0b071b88";ctx.beginPath();ctx.ellipse(0,22,25,9,0,0,Math.PI*2);ctx.fill();
 // dance particles
 if(p.dance!=="idle"){ctx.font="18px serif";ctx.fillText(p.dance==="heart"?"💗":p.dance==="spin"?"✨":"♪",22,-35-Math.sin(t/100)*6)}
 // legs
 ctx.strokeStyle="#35264b";ctx.lineWidth=9;ctx.lineCap="round";let kick=p.dance==="bounce"?Math.sin(t/90)*7:0;
 ctx.beginPath();ctx.moveTo(-8,7);ctx.lineTo(-10+kick,20);ctx.moveTo(8,7);ctx.lineTo(10-kick,20);ctx.stroke();
 // body
 rounded(-17,-18,34,34,12,p.color);
 // arms
 let arm=p.dance==="wave"?Math.sin(t/110)*.7:p.dance==="groove"?Math.sin(t/170)*.5:0;
 ctx.strokeStyle=p.color;ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-14,-9);ctx.lineTo(-25,-2+arm*12);ctx.moveTo(14,-9);ctx.lineTo(25,-2-arm*12);ctx.stroke();
 // head
 ctx.fillStyle="#ffdfc9";ctx.beginPath();ctx.arc(0,-31,18,0,Math.PI*2);ctx.fill();
 // hair/outfit variation
 ctx.fillStyle=["#50304d","#342b55","#8a4c65","#4d526f","#8b5b37","#3e345f"][p.outfit||0];ctx.beginPath();ctx.arc(0,-37,18,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-17,-38,34,8);
 ctx.fillStyle="#39243c";ctx.beginPath();ctx.arc(-6,-30,2,0,Math.PI*2);ctx.arc(6,-30,2,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle="#b75f75";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,-25,4,.15,Math.PI-.15);ctx.stroke();
 ctx.restore();
 // name label
 ctx.font="bold 15px system-ui";ctx.textAlign="center";ctx.lineWidth=4;ctx.strokeStyle="#211431";ctx.strokeText(p.name,x,y-65);ctx.fillStyle=p.id===selfId?"#ffe38a":"#fff";ctx.fillText(p.name,x,y-65);
}
let prev=performance.now();
function frame(now){let dt=Math.min(.04,(now-prev)/1000);prev=now;if(selfId&&players.has(selfId)){update(dt);const p=players.get(selfId);p.x=my.x;p.y=my.y;p.facing=my.facing}drawRoom(now);const list=[...players.values()].sort((a,b)=>a.y-b.y);for(const p of list)drawAvatar(p,now);requestAnimationFrame(frame)}
requestAnimationFrame(frame);
