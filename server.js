const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(express.static(path.join(__dirname, "public")));
app.use("/vendor/three", express.static(path.join(__dirname, "node_modules", "three", "build")));

const rooms = new Map();
const MAX_PLAYERS = 30;
const WIDTH = 1200, HEIGHT = 760;
const dances = new Set(["bounce", "spin", "wave", "groove", "heart", "clap", "moonwalk", "robot", "hiphop", "jump", "cheer", "idle"]);

function makeCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}
function cleanName(s) {
  return String(s || "舞池新星").replace(/[<>]/g, "").trim().slice(0, 14) || "舞池新星";
}
function snapshot(room) {
  return [...room.players.values()].map(p => ({...p}));
}
function emitRoom(room) {
  io.to(room.id).emit("players", snapshot(room));
  io.to(room.id).emit("roomInfo", { count: room.players.size, max: MAX_PLAYERS, name: room.name });
}
function createRoom(isPrivate, name) {
  let id = makeCode();
  while (rooms.has(id)) id = makeCode();
  const room = { id, name: "公共蹦迪大厅", private: false, players: new Map() };
  rooms.set(id, room);
  return room;
}
function leaveRoom(socket) {
  const id = socket.data.roomId;
  if (!id) return;
  const room = rooms.get(id);
  if (room) {
    room.players.delete(socket.id);
    socket.leave(id);
    if (!room.players.size) rooms.delete(id);
    else emitRoom(room);
  }
  socket.data.roomId = null;
}
function joinRoom(socket, room, name) {
  if (room.players.size >= MAX_PLAYERS) return { error: "这个房间已经满员啦（最多30人）" };
  leaveRoom(socket);
  const player = {
    id: socket.id, name: cleanName(name),
    x: 520 + Math.random() * 160, y: 300 + Math.random() * 140,
    color: ["#ff8fab","#8ecae6","#b8e0a5","#cdb4db","#ffd166","#f4a261"][Math.floor(Math.random()*6)],
    outfit: 0, hair: Math.floor(Math.random()*4), skin: Math.floor(Math.random()*4), accessory: "none", dance: "idle", facing: 1
  };
  room.players.set(socket.id, player);
  socket.join(room.id);
  socket.data.roomId = room.id;
  socket.emit("joined", { roomId: room.id, roomName: room.name, private: room.private, selfId: socket.id });
  emitRoom(room);
  return { ok: true };
}

io.on("connection", socket => {
  socket.on("enterPublic", ({name} = {}) => {
    let room = [...rooms.values()].find(r => !r.private && r.players.size < MAX_PLAYERS);
    if (!room) room = createRoom(false, "公共蹦迪大厅");
    joinRoom(socket, room, name);
  });
  socket.on("move", data => {
    const room = rooms.get(socket.data.roomId);
    const p = room && room.players.get(socket.id);
    if (!p || !data) return;
    p.x = Math.max(55, Math.min(WIDTH - 55, Number(data.x) || p.x));
    p.y = Math.max(155, Math.min(HEIGHT - 55, Number(data.y) || p.y));
    if (data.facing === -1 || data.facing === 1) p.facing = data.facing;
    socket.to(room.id).emit("playerMoved", { id: p.id, x: p.x, y: p.y, facing: p.facing });
  });
  socket.on("customize", data => {
    const room = rooms.get(socket.data.roomId);
    const p = room && room.players.get(socket.id);
    if (!p || !data) return;
    if (typeof data.color === "string" && /^#[0-9a-fA-F]{6}$/.test(data.color)) p.color = data.color;
    if (Number.isInteger(data.hair) && data.hair >= 0 && data.hair <= 3) p.hair = data.hair;
    if (Number.isInteger(data.skin) && data.skin >= 0 && data.skin <= 3) p.skin = data.skin;
    if (Number.isInteger(data.outfit) && data.outfit >= 0 && data.outfit <= 3) p.outfit = data.outfit;
    if (["none", "crown", "glasses", "headphones"].includes(data.accessory)) p.accessory = data.accessory;
    emitRoom(room);
  });
  socket.on("dance", dance => {
    const room = rooms.get(socket.data.roomId);
    const p = room && room.players.get(socket.id);
    if (!p || !dances.has(dance)) return;
    p.dance = dance;
    io.to(room.id).emit("playerDance", { id: p.id, dance });
  });
  socket.on("chat", message => {
    const room = rooms.get(socket.data.roomId);
    const p = room && room.players.get(socket.id);
    if (!p) return;
    const text = String(message || "").replace(/[<>]/g, "").trim().slice(0, 100);
    if (text) io.to(room.id).emit("chat", { name: p.name, text, id: p.id, at: Date.now() });
  });
  socket.on("disconnect", () => leaveRoom(socket));
  socket.on("leave", () => leaveRoom(socket));
});

const port = process.env.PORT || 3000;
server.listen(port, "0.0.0.0", () => console.log(`Happy Dance Party running on ${port}`));