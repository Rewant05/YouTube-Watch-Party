import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import "./styles.css";

const SOCKET_URL = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:5000`
  : undefined;

const socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"]
});
const ROLE_OPTIONS = ["Moderator", "Participant", "Viewer"];
const DEFAULT_VIDEO = "dQw4w9WgXcQ";

function getRoomFromUrl() {
  return new URLSearchParams(window.location.search).get("room") || "";
}

function formatTime(seconds = 0) {
  const total = Math.floor(Number(seconds) || 0);
  const min = Math.floor(total / 60);
  const sec = String(total % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function botReply(input, context) {
  const msg = input.toLowerCase();
  if (msg.includes("join") || msg.includes("room")) {
    return "To join: ask the Host to copy the invite link, open it in another tab/account, enter your name, then click Join Existing Room. If testing locally, use two tabs on the same machine or deploy on Render for different devices/accounts.";
  }
  if (msg.includes("role") || msg.includes("moderator") || msg.includes("participant")) {
    return "Roles are enforced by the backend. Host can assign Moderator/Participant/Viewer. Host and Moderator can control video. Participant/Viewer are watch-only.";
  }
  if (msg.includes("sync") || msg.includes("pause") || msg.includes("seek") || msg.includes("play")) {
    return "Sync works through Socket.IO. When Host/Moderator plays, pauses, seeks, or changes video, the server validates permission and broadcasts sync_state to everyone in that room.";
  }
  if (msg.includes("youtube") || msg.includes("black") || msg.includes("video")) {
    return "Use a normal public YouTube watch URL. Some videos block embedding, so try dQw4w9WgXcQ or another public video. Browser extensions can also interfere with YouTube iframes.";
  }
  if (msg.includes("deploy") || msg.includes("render")) {
    return "Render setup: Build Command = npm install && npm run build, Start Command = npm start. After live, test /api/health and then create/join a room using the public URL.";
  }
  if (msg.includes("explain") || msg.includes("architecture")) {
    return "Architecture: React handles UI and YouTube IFrame API. Express serves the app. Socket.IO manages real-time room events. Room objects store participants, roles, videoId, playState, and currentTime.";
  }
  if (context?.role === "Participant" || context?.role === "Viewer") {
    return "You are currently watch-only. Ask the Host to promote you to Moderator if you need playback controls.";
  }
  return "I can help with joining rooms, roles, sync, YouTube issues, deployment, or explaining the architecture. Try asking: 'how does sync work?' or 'why can't participant control video?'";
}

function App() {
  const [showLoader, setShowLoader] = useState(true);
  const [username, setUsername] = useState(localStorage.getItem("watch_username") || "");
  const [roomInput, setRoomInput] = useState(getRoomFromUrl());
  const [videoInput, setVideoInput] = useState("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const [roomId, setRoomId] = useState("");
  const [myUserId, setMyUserId] = useState("");
  const [myRole, setMyRole] = useState("");
  const [participants, setParticipants] = useState([]);
  const [videoId, setVideoId] = useState(DEFAULT_VIDEO);
  const [playState, setPlayState] = useState("paused");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState("Connected UI. Create or join a room to start.");
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [aiMessages, setAiMessages] = useState([
    { from: "ai", text: "Hi! I am the built-in Watch Party assistant. Ask me about joining, sync, roles, deployment, or demo steps." }
  ]);
  const [aiInput, setAiInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [playerError, setPlayerError] = useState("");

  const playerRef = useRef(null);
  const playerReadyRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const currentVideoRef = useRef(videoId);
  const canControlRef = useRef(false);

  const canControl = myRole === "Host" || myRole === "Moderator";
  const isHost = myRole === "Host";
  const shareLink = roomId ? `${window.location.origin}?room=${roomId}` : "";

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoader(false);
    }, 2600);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    currentVideoRef.current = videoId;
  }, [videoId]);

  useEffect(() => {
    canControlRef.current = canControl;
  }, [canControl]);

  useEffect(() => {
  if (!roomId) return;

  let cancelled = false;

  function createPlayer() {
    if (cancelled) return;
    if (playerRef.current) return;
    if (!window.YT || !window.YT.Player) return;

    const playerElement = document.getElementById("youtube-player");

    if (!playerElement) {
      setTimeout(createPlayer, 300);
      return;
    }

    playerRef.current = new window.YT.Player("youtube-player", {
      width: "100%",
      height: "100%",
      videoId: currentVideoRef.current || videoId || "dQw4w9WgXcQ",
      playerVars: {
        autoplay: 0,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        enablejsapi: 1,
        origin: window.location.origin
      },
      events: {
        onReady: (event) => {
          playerReadyRef.current = true;

          const activeVideo =
            currentVideoRef.current || videoId || "dQw4w9WgXcQ";

          event.target.cueVideoById({
            videoId: activeVideo,
            startSeconds: currentTime || 0
          });

          setDuration(event.target.getDuration?.() || 0);
          setPlayerError("");
          setStatus("YouTube player ready.");
          socket.emit("request_sync");
        },

        onError: (event) => {
          const code = event?.data;
          setPlayerError(
            `YouTube player error ${code}. Try another public/embeddable video.`
          );
        },

        onStateChange: (event) => {
          if (
            !canControlRef.current ||
            applyingRemoteRef.current ||
            !playerRef.current ||
            !window.YT
          ) {
            return;
          }

          const time = playerRef.current.getCurrentTime?.() || 0;

          if (event.data === window.YT.PlayerState.PLAYING) {
            socket.emit("play", { currentTime: time });
          }

          if (event.data === window.YT.PlayerState.PAUSED) {
            socket.emit("pause", { currentTime: time });
          }
        }
      }
    });
  }

  if (window.YT?.Player) {
    createPlayer();
  } else {
    const previous = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      createPlayer();
    };

    if (!document.querySelector("script[src='https://www.youtube.com/iframe_api']")) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.body.appendChild(tag);
    }
  }

  const retryTimer = setTimeout(createPlayer, 1000);

  return () => {
    cancelled = true;
    clearTimeout(retryTimer);
  };
}, [roomId]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!playerRef.current || !playerReadyRef.current) return;
      try {
        setCurrentTime(playerRef.current.getCurrentTime?.() || 0);
        setDuration(playerRef.current.getDuration?.() || 0);
      } catch {}
    }, 600);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    socket.on("connect", () => setStatus("Connected to Socket.IO server."));
    socket.on("disconnect", () => setStatus("Disconnected. Reconnecting..."));
    socket.on("server_ready", ({ userId }) => setMyUserId(userId));
    socket.on("sync_state", applySyncState);
    socket.on("participants_updated", ({ participants }) => updateParticipants(participants));
    socket.on("user_joined", ({ username, role, participants }) => {
      updateParticipants(participants);
      setStatus(`${username} joined as ${role}.`);
    });
    socket.on("user_left", ({ username, participants }) => {
      updateParticipants(participants);
      setStatus(`${username} left the room.`);
    });
    socket.on("role_assigned", ({ participants }) => {
      updateParticipants(participants);
      setStatus("Role updated successfully.");
    });
    socket.on("participant_removed", ({ participants }) => {
      updateParticipants(participants);
      setStatus("Participant removed.");
    });
    socket.on("removed_from_room", ({ message }) => {
      setStatus(message);
      resetRoom();
    });
    socket.on("action_error", ({ message }) => setStatus(message));
    socket.on("chat_message", (payload) => setChat((prev) => [...prev.slice(-60), payload]));

    return () => {
      socket.removeAllListeners();
    };
  }, []);

  function updateParticipants(next = []) {
    setParticipants(next);
    const me = next.find((p) => p.userId === socket.id || p.userId === myUserId);
    if (me) {
      setMyUserId(me.userId);
      setMyRole(me.role);
    }
  }

  function applySyncState(state) {
    setVideoId(state.videoId);
    setPlayState(state.playState);
    setCurrentTime(state.currentTime || 0);
    setPlayerError("");

    if (!playerRef.current || !playerReadyRef.current) return;
    const player = playerRef.current;
    applyingRemoteRef.current = true;

    try {
      const playerVideo = player.getVideoData?.().video_id;
      if (playerVideo !== state.videoId) {
        player.loadVideoById({ videoId: state.videoId, startSeconds: state.currentTime || 0 });
      } else {
        const localTime = player.getCurrentTime?.() || 0;
        if (Math.abs(localTime - (state.currentTime || 0)) > 1.3) {
          player.seekTo(state.currentTime || 0, true);
        }
      }

      setTimeout(() => {
        if (state.playState === "playing") player.playVideo?.();
        else player.pauseVideo?.();
      }, 300);
    } catch {
      setPlayerError("Player sync failed. Refresh the page and try again.");
    }

    setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 1000);
  }

  function validateUsername() {
    const clean = username.trim();
    if (!clean) {
      setStatus("Enter your name first.");
      return null;
    }
    localStorage.setItem("watch_username", clean);
    return clean;
  }

  function createRoom() {
    const clean = validateUsername();
    if (!clean) return;
    socket.emit("create_room", { username: clean, videoInput }, (res) => {
      if (!res?.ok) return setStatus(res?.message || "Could not create room.");
      setRoomId(res.roomId);
      setRoomInput(res.roomId);
      setMyUserId(res.userId);
      setMyRole(res.role);
      setParticipants(res.participants);
      setChat([]);
      applySyncState(res.state);
      setStatus(`Room ${res.roomId} created. You are Host.`);
      window.history.replaceState({}, "", `?room=${res.roomId}`);
    });
  }

  function joinRoom() {
    const clean = validateUsername();
    if (!clean) return;
    socket.emit("join_room", { roomId: roomInput, username: clean }, (res) => {
      if (!res?.ok) return setStatus(res?.message || "Could not join room.");
      setRoomId(res.roomId);
      setRoomInput(res.roomId);
      setMyUserId(res.userId);
      setMyRole(res.role);
      setParticipants(res.participants);
      setChat([]);
      applySyncState(res.state);
      setStatus(`Joined room ${res.roomId} as ${res.role}.`);
      window.history.replaceState({}, "", `?room=${res.roomId}`);
    });
  }

  function resetRoom() {
    setRoomId("");
    setRoomInput("");
    setMyRole("");
    setParticipants([]);
    setChat([]);
    window.history.replaceState({}, "", "/");
  }

  function leaveRoom() {
    socket.emit("leave_room");
    resetRoom();
    setStatus("You left the room.");
  }

  function playVideo() {
    if (!canControl || !playerRef.current) return;
    socket.emit("play", { currentTime: playerRef.current.getCurrentTime?.() || 0 });
  }

  function pauseVideo() {
    if (!canControl || !playerRef.current) return;
    socket.emit("pause", { currentTime: playerRef.current.getCurrentTime?.() || 0 });
  }

  function seekVideo(e) {
    if (!canControl) return;
    socket.emit("seek", { time: Number(e.target.value) });
  }

  function changeVideo() {
    if (!canControl) return;
    socket.emit("change_video", { videoInput });
  }

  function assignRole(userId, role) {
    socket.emit("assign_role", { userId, role });
  }

  function removeParticipant(userId) {
    socket.emit("remove_participant", { userId });
  }

  function transferHost(userId) {
    socket.emit("transfer_host", { userId });
  }

  function sendChat(e) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    socket.emit("chat_message", { message: text });
    setChatInput("");
  }

  function askAi(e) {
    e.preventDefault();
    const text = aiInput.trim();
    if (!text) return;
    const answer = botReply(text, { role: myRole, roomId });
    setAiMessages((prev) => [...prev.slice(-20), { from: "you", text }, { from: "ai", text: answer }]);
    setAiInput("");
  }

  async function copyLink() {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const roleText = useMemo(() => {
    if (!myRole) return "Not in room";
    return `${myRole} • ${canControl ? "Controls enabled" : "Watch only"}`;
  }, [myRole, canControl]);

  return (
    <>
      {showLoader && <PixelLoader />}

      <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Socket.IO • YouTube IFrame API • RBAC</p>
          <h1>YouTube Watch Party</h1>
          <p className="subtitle">Create a room, invite friends, sync YouTube playback in real time, and control permissions with Host/Moderator/Participant roles.</p>
        </div>
        <div className="role-pill">{roleText}</div>
      </header>

      {!roomId && (
        <section className="landing panel">
          <div className="form-card">
            <h2>Start or join a room</h2>
            <label>Your name<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Rewant" /></label>
            <label>YouTube URL or video ID<input value={videoInput} onChange={(e) => setVideoInput(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></label>
            <button className="primary" onClick={createRoom}>Create Room as Host</button>
            <div className="divider"><span>or</span></div>
            <label>Room code<input value={roomInput} onChange={(e) => setRoomInput(e.target.value.toUpperCase())} placeholder="ABC123" /></label>
            <button className="secondary" onClick={joinRoom}>Join Existing Room</button>
            <p className="status">{status}</p>
          </div>

          <div className="info-card">
            <h3>Assignment coverage</h3>
            <ul>
              <li>Room creation and shareable room code</li>
              <li>Real-time WebSocket synchronization</li>
              <li>Play, pause, seek and video-change sync</li>
              <li>Host/Moderator/Participant roles</li>
              <li>Backend role validation</li>
              <li>Host can promote/remove/transfer host</li>
              <li>Bonus chat and AI helper</li>
            </ul>
          </div>
        </section>
      )}

      {roomId && (
        <main className="room-grid">
          <section className="watch-panel panel">
            <div className="room-bar">
              <div><span className="muted">Room</span><strong>{roomId}</strong></div>
              <button onClick={copyLink}>{copied ? "Copied!" : "Copy Invite Link"}</button>
              <button className="danger-outline" onClick={leaveRoom}>Leave</button>
            </div>

            <div className="player-shell">
              <div id="youtube-player"></div>
              {!canControl && <div className="viewer-lock">Watch-only mode: Host or Moderator controls playback.</div>}
              {playerError && <div className="player-error">{playerError}</div>}
            </div>

            <div className="controls">
              <button disabled={!canControl} onClick={playVideo}>Play</button>
              <button disabled={!canControl} onClick={pauseVideo}>Pause</button>
              <span>{formatTime(currentTime)}</span>
              <input type="range" min="0" max={duration || 1} value={Math.min(currentTime, duration || 1)} onChange={seekVideo} disabled={!canControl} />
              <span>{formatTime(duration)}</span>
            </div>

            <div className="change-video">
              <input value={videoInput} onChange={(e) => setVideoInput(e.target.value)} disabled={!canControl} placeholder="Paste new YouTube URL" />
              <button disabled={!canControl} onClick={changeVideo}>Change Video</button>
            </div>
            <p className="status">{status}</p>
          </section>

          <aside className="side-panel">
            <section className="participants-card panel">
              <h2>Participants</h2>
              {participants.map((person) => (
                <div className="participant" key={person.userId}>
                  <div><strong>{person.username}</strong><span>{person.role}{person.userId === myUserId ? " • You" : ""}</span></div>
                  {isHost && person.userId !== myUserId && (
                    <div className="admin-actions">
                      <select value={person.role} onChange={(e) => assignRole(person.userId, e.target.value)}>
                        {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                      <button onClick={() => transferHost(person.userId)}>Make Host</button>
                      <button className="danger" onClick={() => removeParticipant(person.userId)}>Remove</button>
                    </div>
                  )}
                </div>
              ))}
            </section>

            <section className="chat-card panel">
              <h2>Room Chat</h2>
              <div className="chat-box">
                {chat.length === 0 && <p className="muted">No messages yet.</p>}
                {chat.map((item, i) => <div className="chat-message" key={`${item.timestamp}-${i}`}><strong>{item.username}</strong><span>{item.message}</span></div>)}
              </div>
              <form onSubmit={sendChat} className="chat-form"><input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message..." /><button>Send</button></form>
            </section>

            <section className="ai-card panel">
              <h2>AI Watch Assistant</h2>
              <div className="ai-box">
                {aiMessages.map((m, i) => <div className={`ai-msg ${m.from}`} key={i}><span>{m.from === "ai" ? "AI" : "You"}</span><p>{m.text}</p></div>)}
              </div>
              <form onSubmit={askAi} className="chat-form"><input value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="Ask about sync, roles, deployment..." /><button>Ask</button></form>
            </section>
          </aside>
        </main>
      )}

      <footer>Built with React, Express, Socket.IO and YouTube IFrame API.</footer>
      </div>
    </>
  );
}

function PixelLoader() {
  const pixels = Array.from({ length: 64 });

  return (
    <div className="pixel-loader">
      <div className="pixel-bg-glow"></div>

      <div className="pixel-logo-stage">
        <div className="pixel-grid" aria-hidden="true">
          {pixels.map((_, index) => (
            <span
              key={index}
              className="pixel-dot"
              style={{
                "--i": index,
                "--x": `${(index % 8) - 3.5}`,
                "--y": `${Math.floor(index / 8) - 3.5}`
              }}
            />
          ))}
        </div>

        <div className="stream-play-logo">
          <div className="play-triangle"></div>
        </div>

        <div className="loader-title">
          <span>SYNC</span>
          <strong>STREAM</strong>
        </div>

        <p className="loader-subtitle">Preparing your watch party...</p>

        <div className="loader-bar">
          <span></span>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
