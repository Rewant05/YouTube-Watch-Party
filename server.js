const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000
});

const ROLES = {
  HOST: "Host",
  MODERATOR: "Moderator",
  PARTICIPANT: "Participant",
  VIEWER: "Viewer"
};

function isController(role) {
  return role === ROLES.HOST || role === ROLES.MODERATOR;
}

function safeName(username) {
  return String(username || "Guest").trim().slice(0, 30) || "Guest";
}

function extractVideoId(input) {
  if (!input) return null;
  const value = String(input).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[1];
  }
  return null;
}

class Participant {
  constructor(socketId, username, role = ROLES.PARTICIPANT) {
    this.userId = socketId;
    this.username = safeName(username);
    this.role = role;
    this.joinedAt = new Date().toISOString();
  }
}

class Room {
  constructor(roomId, hostSocketId, hostUsername, initialVideoId) {
    this.roomId = roomId;
    this.participants = new Map();
    this.state = {
      videoId: initialVideoId || "dQw4w9WgXcQ",
      playState: "paused",
      currentTime: 0,
      lastUpdatedAt: Date.now()
    };
    this.createdAt = new Date().toISOString();
    this.addParticipant(hostSocketId, hostUsername, ROLES.HOST);
  }

  addParticipant(socketId, username, role = ROLES.PARTICIPANT) {
    const participant = new Participant(socketId, username, role);
    this.participants.set(socketId, participant);
    return participant;
  }

  removeParticipant(socketId) {
    const participant = this.participants.get(socketId);
    this.participants.delete(socketId);
    return participant;
  }

  getParticipant(socketId) {
    return this.participants.get(socketId);
  }

  listParticipants() {
    return Array.from(this.participants.values());
  }

  getEffectiveCurrentTime() {
    if (this.state.playState !== "playing") return this.state.currentTime;
    return this.state.currentTime + (Date.now() - this.state.lastUpdatedAt) / 1000;
  }

  getSyncState() {
    return {
      videoId: this.state.videoId,
      playState: this.state.playState,
      currentTime: Math.max(0, this.getEffectiveCurrentTime())
    };
  }

  updatePlayback(playState, currentTime) {
    this.state.playState = playState;
    this.state.currentTime = Number.isFinite(Number(currentTime))
      ? Math.max(0, Number(currentTime))
      : this.getEffectiveCurrentTime();
    this.state.lastUpdatedAt = Date.now();
  }

  seek(time) {
    this.state.currentTime = Math.max(0, Number(time) || 0);
    this.state.lastUpdatedAt = Date.now();
  }

  changeVideo(videoId) {
    this.state.videoId = videoId;
    this.state.playState = "paused";
    this.state.currentTime = 0;
    this.state.lastUpdatedAt = Date.now();
  }

  canControl(socketId) {
    const participant = this.getParticipant(socketId);
    return Boolean(participant && isController(participant.role));
  }

  isHost(socketId) {
    const participant = this.getParticipant(socketId);
    return Boolean(participant && participant.role === ROLES.HOST);
  }

  assignRole(userId, role) {
    const participant = this.getParticipant(userId);
    if (!participant) return null;
    if (![ROLES.MODERATOR, ROLES.PARTICIPANT, ROLES.VIEWER].includes(role)) return null;
    participant.role = role;
    return participant;
  }

  transferHost(oldHostId, newHostId) {
    const oldHost = this.getParticipant(oldHostId);
    const newHost = this.getParticipant(newHostId);
    if (!oldHost || !newHost) return false;
    oldHost.role = ROLES.PARTICIPANT;
    newHost.role = ROLES.HOST;
    return true;
  }

  ensureHostExists() {
    if (this.participants.size === 0) return;
    const hasHost = this.listParticipants().some((p) => p.role === ROLES.HOST);
    if (!hasHost) this.listParticipants()[0].role = ROLES.HOST;
  }
}

const rooms = new Map();

function createRoomId() {
  let roomId;
  do {
    roomId = nanoid(6).replace(/[-_]/g, "A").toUpperCase();
  } while (rooms.has(roomId));
  return roomId;
}

function roomPayload(room) {
  return {
    roomId: room.roomId,
    state: room.getSyncState(),
    participants: room.listParticipants()
  };
}

function sendError(socket, event, message) {
  socket.emit("action_error", { event, message });
}

function getRoomForSocket(socket) {
  return socket.data.roomId ? rooms.get(socket.data.roomId) : null;
}

function updateEveryone(room, reason = "participants_updated") {
  io.to(room.roomId).emit(reason, { participants: room.listParticipants() });
}

io.on("connection", (socket) => {
  socket.emit("server_ready", { userId: socket.id });

  socket.on("create_room", ({ username, videoInput } = {}, callback) => {
    const roomId = createRoomId();
    const videoId = extractVideoId(videoInput) || "dQw4w9WgXcQ";
    const room = new Room(roomId, socket.id, username, videoId);
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.data.roomId = roomId;

    callback?.({ ok: true, userId: socket.id, role: ROLES.HOST, ...roomPayload(room) });
  });

  socket.on("join_room", ({ roomId, username } = {}, callback) => {
    const normalizedRoomId = String(roomId || "").trim().toUpperCase();
    const room = rooms.get(normalizedRoomId);
    if (!room) {
      callback?.({ ok: false, message: "Room not found. Ask the host for the latest room code/link." });
      return;
    }

    const participant = room.addParticipant(socket.id, username, ROLES.PARTICIPANT);
    socket.join(normalizedRoomId);
    socket.data.roomId = normalizedRoomId;

    callback?.({ ok: true, userId: socket.id, role: participant.role, ...roomPayload(room) });
    io.to(normalizedRoomId).emit("user_joined", {
      username: participant.username,
      userId: participant.userId,
      role: participant.role,
      participants: room.listParticipants()
    });
  });

  socket.on("request_sync", () => {
    const room = getRoomForSocket(socket);
    if (!room) return;
    socket.emit("sync_state", { ...room.getSyncState(), updatedBy: "server" });
  });

  socket.on("play", ({ currentTime } = {}) => {
    const room = getRoomForSocket(socket);
    if (!room) return sendError(socket, "play", "Join a room first.");
    if (!room.canControl(socket.id)) return sendError(socket, "play", "Only Host or Moderator can play.");
    room.updatePlayback("playing", currentTime);
    io.to(room.roomId).emit("sync_state", { ...room.getSyncState(), updatedBy: socket.id });
  });

  socket.on("pause", ({ currentTime } = {}) => {
    const room = getRoomForSocket(socket);
    if (!room) return sendError(socket, "pause", "Join a room first.");
    if (!room.canControl(socket.id)) return sendError(socket, "pause", "Only Host or Moderator can pause.");
    room.updatePlayback("paused", currentTime);
    io.to(room.roomId).emit("sync_state", { ...room.getSyncState(), updatedBy: socket.id });
  });

  socket.on("seek", ({ time } = {}) => {
    const room = getRoomForSocket(socket);
    if (!room) return sendError(socket, "seek", "Join a room first.");
    if (!room.canControl(socket.id)) return sendError(socket, "seek", "Only Host or Moderator can seek.");
    room.seek(time);
    io.to(room.roomId).emit("sync_state", { ...room.getSyncState(), updatedBy: socket.id });
  });

  socket.on("change_video", ({ videoInput } = {}) => {
    const room = getRoomForSocket(socket);
    if (!room) return sendError(socket, "change_video", "Join a room first.");
    if (!room.canControl(socket.id)) return sendError(socket, "change_video", "Only Host or Moderator can change video.");
    const videoId = extractVideoId(videoInput);
    if (!videoId) return sendError(socket, "change_video", "Paste a valid YouTube URL or 11-character video ID.");
    room.changeVideo(videoId);
    io.to(room.roomId).emit("sync_state", { ...room.getSyncState(), updatedBy: socket.id });
  });

  socket.on("assign_role", ({ userId, role } = {}) => {
    const room = getRoomForSocket(socket);
    if (!room) return sendError(socket, "assign_role", "Join a room first.");
    if (!room.isHost(socket.id)) return sendError(socket, "assign_role", "Only Host can assign roles.");
    if (userId === socket.id) return sendError(socket, "assign_role", "Host cannot demote themselves using this menu. Transfer host instead.");
    const participant = room.assignRole(userId, role);
    if (!participant) return sendError(socket, "assign_role", "Invalid participant or role.");
    io.to(room.roomId).emit("role_assigned", {
      userId,
      username: participant.username,
      role: participant.role,
      participants: room.listParticipants()
    });
  });

  socket.on("transfer_host", ({ userId } = {}) => {
    const room = getRoomForSocket(socket);
    if (!room) return sendError(socket, "transfer_host", "Join a room first.");
    if (!room.isHost(socket.id)) return sendError(socket, "transfer_host", "Only Host can transfer host role.");
    if (userId === socket.id) return sendError(socket, "transfer_host", "You are already Host.");
    const ok = room.transferHost(socket.id, userId);
    if (!ok) return sendError(socket, "transfer_host", "Participant not found.");
    io.to(room.roomId).emit("role_assigned", {
      userId,
      username: room.getParticipant(userId)?.username,
      role: ROLES.HOST,
      participants: room.listParticipants()
    });
  });

  socket.on("remove_participant", ({ userId } = {}) => {
    const room = getRoomForSocket(socket);
    if (!room) return sendError(socket, "remove_participant", "Join a room first.");
    if (!room.isHost(socket.id)) return sendError(socket, "remove_participant", "Only Host can remove participants.");
    if (userId === socket.id) return sendError(socket, "remove_participant", "Host cannot remove themselves.");
    const removed = room.removeParticipant(userId);
    if (!removed) return sendError(socket, "remove_participant", "Participant not found.");
    const target = io.sockets.sockets.get(userId);
    if (target) {
      target.emit("removed_from_room", { message: "You were removed by the Host." });
      target.leave(room.roomId);
      target.data.roomId = null;
    }
    io.to(room.roomId).emit("participant_removed", { userId, participants: room.listParticipants() });
  });

  socket.on("chat_message", ({ message } = {}) => {
    const room = getRoomForSocket(socket);
    if (!room) return;
    const participant = room.getParticipant(socket.id);
    const text = String(message || "").trim();
    if (!participant || !text) return;
    io.to(room.roomId).emit("chat_message", {
      userId: socket.id,
      username: participant.username,
      role: participant.role,
      message: text.slice(0, 300),
      timestamp: new Date().toISOString()
    });
  });

  socket.on("leave_room", () => handleLeave(socket));
  socket.on("disconnect", () => handleLeave(socket));
});

function handleLeave(socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;
  const removed = room.removeParticipant(socket.id);
  socket.leave(roomId);
  socket.data.roomId = null;
  if (room.participants.size === 0) {
    rooms.delete(roomId);
    return;
  }
  room.ensureHostExists();
  io.to(roomId).emit("user_left", {
    username: removed?.username || "Unknown",
    userId: socket.id,
    participants: room.listParticipants()
  });
  updateEveryone(room);
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, app: "YouTube Watch Party", activeRooms: rooms.size, timestamp: new Date().toISOString() });
});

app.get("/api/rooms/:roomId", (req, res) => {
  const room = rooms.get(String(req.params.roomId || "").trim().toUpperCase());
  if (!room) return res.status(404).json({ ok: false, message: "Room not found" });
  res.json({ ok: true, ...roomPayload(room) });
});

const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));
app.get(/^(?!\/socket\.io|\/api).*/, (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`YouTube Watch Party server running on port ${PORT}`));
