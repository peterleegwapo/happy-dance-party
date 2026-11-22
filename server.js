const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(express.static("public"));

const rooms = new Map();
const MAX_PLAYERS = 30;
const WIDTH = 1200, HEIGHT = 760;
const dances = new Set(["bounce", "spin", "wave", "groove", "heart"]);

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
  const room = { id, name: cleanName(name || (isPrivate ? "好友派对" : "公开舞池")), private: isPrivate, players: new Map() };
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
    outfit: Math.floor(Math.random()*6), dance: "idle", facing: 1
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
  socket.on("createPrivate", ({name, roomName} = {}) => {
    const room = createRoom(true, roomName);
    joinRoom(socket, room, name);
  });
  socket.on("joinPrivate", ({name, code} = {}) => {
    const room = rooms.get(String(code || "").trim().toUpperCase());
    if (!room || !room.private) return socket.emit("notice", "没有找到这个私人房间，请检查房间码");
    const result = joinRoom(socket, room, name);
    if (result.error) socket.emit("notice", result.error);
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