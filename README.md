# YouTube Watch Party Pro

A real-time YouTube watch party app where people can join the same room and watch a video together in sync.

The idea is simple: one person creates a room as the **Host**, shares the room link/code, and others join as **Participants**. When the Host plays, pauses, seeks, or changes the video, everyone in the room sees the same update instantly.

This project was built as a full-stack intern assignment using **React, Vite, Node.js, Express, Socket.IO, and the YouTube IFrame API**.

---

## Live Demo

Add your deployed Render URL here after deployment:

```txt
https://your-render-url.onrender.com
```

Health check endpoint:

```txt
https://your-render-url.onrender.com/api/health
```

---

## What this app does

- Lets a user create a watch room with a unique room code
- Lets other users join using the room code or invite link
- Embeds a YouTube player inside the room
- Keeps playback synchronized for everyone in the room
- Syncs play, pause, seek, and video changes in real time
- Shows the live participant list with roles
- Supports Host, Moderator, Participant, and Viewer roles
- Validates permissions on the backend before accepting playback actions
- Allows the Host to promote/demote users
- Allows the Host to remove participants
- Allows the Host to transfer Host role
- Includes live room chat
- Includes an AI Watch Assistant for help, demo guidance, and explanation

---

## Tech Stack

| Part | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Real-time Communication | Socket.IO |
| Video Player | YouTube IFrame API |
| Storage | In-memory room storage |
| Deployment | Render |

---

## How the app works

The React frontend connects to the Node.js backend using Socket.IO. Every browser tab gets a unique socket ID.

When a user creates a room, the backend creates a `Room` object and stores it in memory. That room keeps track of:

- Room ID
- Current video ID
- Playback state
- Current video timestamp
- Connected participants
- Roles of each participant

When a Host or Moderator performs an action such as play, pause, seek, or change video, the frontend sends that event to the backend.

The backend then:

1. Finds the room connected to that socket.
2. Checks the user's role.
3. Rejects the action if the user does not have permission.
4. Updates the room state if the action is valid.
5. Broadcasts the updated video state to everyone in that room.

All connected users receive the latest `sync_state` event and their local YouTube player updates accordingly.

---

## Role-Based Access Control

| Role | What they can do |
|---|---|
| Host | Full control: play, pause, seek, change video, assign roles, remove users, and transfer Host |
| Moderator | Can play, pause, seek, and change video |
| Participant | Watch-only |
| Viewer | Watch-only |

The frontend disables restricted controls for Participants/Viewers, but the main permission check happens on the backend. This means even if someone tries to manually trigger a restricted event, the server will reject it.

---

## Main Socket.IO Events

### Client to Server

| Event | Purpose | Permission |
|---|---|---|
| `create_room` | Creates a new room | Anyone |
| `join_room` | Joins an existing room | Anyone |
| `play` | Plays the video | Host / Moderator |
| `pause` | Pauses the video | Host / Moderator |
| `seek` | Seeks to a timestamp | Host / Moderator |
| `change_video` | Changes the YouTube video | Host / Moderator |
| `assign_role` | Changes a user's role | Host only |
| `remove_participant` | Removes a user from the room | Host only |
| `transfer_host` | Transfers Host role | Host only |
| `chat_message` | Sends a chat message | Room members |

### Server to Client

| Event | Purpose |
|---|---|
| `sync_state` | Sends the latest video state to all users |
| `user_joined` | Notifies room when a new user joins |
| `user_left` | Notifies room when a user leaves |
| `participants_updated` | Sends the updated participant list |
| `role_assigned` | Notifies users when a role changes |
| `participant_removed` | Notifies room when a participant is removed |
| `removed_from_room` | Tells a user they were removed by the Host |
| `action_error` | Sends permission or validation errors |

---

## Run Locally

### 1. Install dependencies

```bash
npm install
```

### 2. Start frontend and backend together

```bash
npm run dev
```

Open the app:

```txt
http://localhost:5173
```

The backend runs on:

```txt
http://localhost:5000
```

### 3. Test production build locally

```bash
npm run build
npm start
```

Then open:

```txt
http://localhost:5000
```

---

## Deployment on Render

Create a new **Web Service** on Render and connect your GitHub repository.

Use these settings:

```txt
Environment: Node
Build Command: npm install && npm run build
Start Command: npm start
```

After deployment, test the health route:

```txt
https://your-render-url.onrender.com/api/health
```

Then open the main live URL and test room creation/joining.

---

## Demo Flow

1. Open the live app.
2. Enter your name.
3. Create a room as Host.
4. Copy the invite link or room code.
5. Open the link in another browser/incognito tab.
6. Join as a second user.
7. Confirm the second user appears as Participant.
8. From the Host tab, play/pause/seek/change the video.
9. Confirm the second tab stays synchronized.
10. Promote the Participant to Moderator.
11. Confirm Moderator can control playback.
12. Change them back to Participant.
13. Confirm Participant becomes watch-only again.
14. Remove the participant from the Host panel.
15. Test chat and AI Watch Assistant.

---

## Important Notes

- Rooms are stored in memory, so they reset when the server restarts.
- Some YouTube videos do not allow embedding. Use a normal public video for demo.
- Browser extensions can sometimes block YouTube iframes. If the player does not load, try Chrome Incognito.
- `localhost` only works on your own laptop. For testing on different devices/accounts, use the deployed Render URL.
- This MVP focuses on the main assignment requirements. A database can be added later for persistent rooms.

---

## Possible Future Improvements

- Add user authentication
- Store rooms permanently using PostgreSQL, MongoDB, or SQLite
- Add Redis Pub/Sub for scaling across multiple servers
- Use Socket.IO Redis Adapter for horizontal scaling
- Add emoji reactions
- Improve playback drift correction
- Add room history and saved playlists

---

## Project Status

Core assignment features are implemented:

- Real-time synchronization
- Room-based watch parties
- YouTube integration
- WebSocket communication using Socket.IO
- Role-based access control
- Host participant management
- Deployment-ready setup
