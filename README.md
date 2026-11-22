# Happy Dance Party 🪩

A starter multiplayer 2D dance-room game. One room supports up to 30 simultaneous players. Includes public rooms, private rooms with 6-character codes, live movement, dance emotes and chat. Responsive controls support desktop and mobile.

## Run locally
1. Install Node.js 18 or newer.
2. In this folder run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000`.

For friends to play from different devices, deploy this Node app to a public Node hosting service that supports WebSockets (Socket.IO), such as Render, Railway, or a VPS. Do not deploy as a static-only website. Share the deployed HTTPS URL.

## Notes
- Current prototype stores rooms and players in server memory. Restarting the server closes all rooms.
- Public rooms are automatically reused until they reach 30 players; then a new public room is created.
- Private room codes are six-character codes.
- The prototype has no account system, persistent profiles, moderation dashboard, or voice chat yet.
- Use licensed or royalty-free music if adding background tracks. This starter does not stream copyrighted music.
