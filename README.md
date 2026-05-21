# YouTube Watch Party Pro

A real-time YouTube watch party app where multiple users can join the same room and watch a YouTube video together in sync.

The idea is simple: one user creates a room as the **Host**, shares the room link/code, and others join as **Participants**. When the Host plays, pauses, seeks, or changes the video, every connected user receives the same update in real time.

This project was built as a full-stack intern assignment using **React, Vite, Node.js, Express, Socket.IO, and the YouTube IFrame API**.

---

## Live Demo

Live App:

```txt
https://youtube-watch-party-bfwn.onrender.com
```

Health Check:

```txt
https://youtube-watch-party-bfwn.onrender.com/api/health
```

GitHub Repository:

```txt
https://github.com/Rewant05/YouTube-Watch-Party
```

---

## Assignment Coverage

This project covers the required deliverables:

| Requirement | Status |
|---|---|
| Working application running locally | Completed |
| Public deployment | Completed on Render |
| README with setup instructions and live URL | Completed |
| Architecture overview | Included below |
| WebSocket flow explanation | Included below |
| Code walkthrough readiness | Included below |
| Demo video/screenshots | Optional, can be added separately |

---

## What the app does

- Creates a watch room with a unique room code
- Allows users to join using a room code or invite link
- Embeds a YouTube video player inside the room
- Synchronizes play, pause, seek, and video changes in real time
- Displays a live participant list with roles
- Supports **Host**, **Moderator**, **Participant**, and **Viewer** roles
- Validates permissions on the backend before accepting playback actions
- Allows the Host to promote/demote users
- Allows the Host to remove participants
- Allows the Host to transfer the Host role
- Includes live room chat
- Includes an AI Watch Assistant for help, demo guidance, and architecture explanation
- Includes a custom loading screen and favicon for a more polished user experience

---

## Tech Stack

| Part | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Real-time Communication | Socket.IO |
| Video Player | YouTube IFrame API |
| Room Storage | In-memory room storage |
| Deployment | Render |

---

## How the app works

The React frontend connects to the Node.js backend using Socket.IO. Each browser tab gets a unique socket ID.

When a user creates a room, the backend creates a `Room` object and stores it in memory. The room keeps track of:

- Room ID
- Current YouTube video ID
- Playback state
- Current video timestamp
- Connected participants
- Role of each participant

When a Host or Moderator performs an action such as play, pause, seek, or change video, the frontend sends a Socket.IO event to the backend.

The backend then:

1. Finds the room connected to that socket.
2. Checks the user's role.
3. Rejects the action if the user does not have permission.
4. Updates the room state if the action is valid.
5. Broadcasts the updated video state to every connected user in that room.

Every client receives the latest `sync_state` event and updates its local YouTube player accordingly.

This keeps all users synchronized while still making the backend responsible for permission validation.

---

## Role-Based Access Control

| Role | Permissions |
|---|---|
| Host | Full control: play, pause, seek, change video, assign roles, remove users, and transfer Host |
| Moderator | Can play, pause, seek, and change video |
| Participant | Watch-only |
| Viewer | Watch-only |

The frontend disables restricted controls for Participants/Viewers, but the real permission check happens on the backend. This means even if someone manually triggers a restricted Socket.IO event, the server rejects it.

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
| `user_joined` | Notifies the room when a new user joins |
| `user_left` | Notifies the room when a user leaves |
| `participants_updated` | Sends the updated participant list |
| `role_assigned` | Notifies users when a role changes |
| `participant_removed` | Notifies the room when a participant is removed |
| `removed_from_room` | Tells a user they were removed by the Host |
| `action_error` | Sends permission or validation errors |

---

## OOP Structure Used on Backend

The backend uses class-based room management to keep the logic organized.

### `Room` class

The `Room` class manages:

- Room ID
- Participants
- Current video state
- Playback state
- Role checks
- Playback updates
- Role assignment
- Host transfer
- Participant removal

### `Participant` class

The `Participant` class represents each connected user and stores:

- Socket/user ID
- Username
- Role
- Join time

This keeps the WebSocket logic cleaner because room-related behavior is encapsulated instead of being scattered across event handlers.

---

## Bonus Features Implemented

| Bonus Idea | Status |
|---|---|
| OOP concepts for WebSocket server | Implemented with `Room` and `Participant` classes |
| Text chat in the room | Implemented |
| Transfer Host role | Implemented |
| AI assistant | Implemented as an additional helper feature |
| Reactions / emoji reactions | Not implemented |
| Persistent rooms using database | Not implemented in MVP |
| Authentication before joining | Not implemented in MVP |
| Redis Pub/Sub / horizontal scaling | Explained as future improvement |

---

## Scalability Notes

This MVP uses in-memory room storage, which is enough for the assignment demo and a single-server Render deployment.

For a production-scale version with many rooms and users, the app can be improved by adding:

- A database such as PostgreSQL, MongoDB, or SQLite for persistent rooms
- Redis Pub/Sub for cross-server room communication
- Socket.IO Redis Adapter for horizontal scaling
- A load balancer for multiple WebSocket server instances
- Connection pooling for database-backed features
- Authentication for user identity and safer role management

This would allow the system to scale beyond one server instance and support many concurrent rooms.

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

Create a new **Web Service** on Render and connect the GitHub repository.

Use these settings:

```txt
Environment: Node
Build Command: npm install && npm run build
Start Command: npm start
```

After deployment, test the health route:

```txt
https://youtube-watch-party-bfwn.onrender.com/api/health
```

Then open the main live URL:

```txt
https://youtube-watch-party-bfwn.onrender.com
```

---

## Demo Flow

1. Open the live app.
2. Enter your name.
3. Create a room as Host.
4. Copy the invite link or room code.
5. Open the invite link in another browser/incognito tab.
6. Join as a second user.
7. Confirm the second user appears as Participant.
8. From the Host tab, play/pause/seek/change the video.
9. Confirm the second tab stays synchronized.
10. Promote the Participant to Moderator.
11. Confirm the Moderator can control playback.
12. Change them back to Participant.
13. Confirm the Participant becomes watch-only again.
14. Remove the participant from the Host panel.
15. Test room chat and AI Watch Assistant.

---

## Code Walkthrough Readiness

### React + Vite

React is used for the user interface, room creation/joining flow, participant list, chat, role controls, loading screen, and AI Watch Assistant. Vite is used for fast local development and production builds.

### Express

Express is used to create the Node.js backend server. It also serves the production React build after `npm run build`.

### Socket.IO

Socket.IO is used for real-time bidirectional communication. It lets the server broadcast playback updates only to users inside the same room.

### YouTube IFrame API

The YouTube IFrame API is used to embed and control the YouTube player programmatically. The app uses it to load videos, play, pause, and seek based on server sync events.

### Backend role enforcement

The backend checks the user's role before processing protected events like `play`, `pause`, `seek`, `change_video`, `assign_role`, and `remove_participant`.

### Deployment

The app is deployed as a Render Web Service. Render builds the React frontend using Vite and then starts the Express/Socket.IO server.

---

## Important Notes

- Rooms are stored in memory, so they reset when the server restarts.
- Some YouTube videos do not allow embedding. Use a normal public YouTube video for demo.
- Browser extensions can sometimes block YouTube iframes. If the player does not load, try Chrome Incognito.
- `localhost` only works on your own laptop. For testing on different devices/accounts, use the deployed Render URL.
- This MVP focuses on the main assignment requirements. A database can be added later for persistent rooms.

---

## Possible Future Improvements

- Add user authentication
- Store rooms permanently using PostgreSQL, MongoDB, or SQLite
- Add Redis Pub/Sub for cross-server communication
- Use Socket.IO Redis Adapter for horizontal scaling
- Add emoji reactions
- Improve playback drift correction
- Add room history and saved playlists
- Add proper user profiles and saved watch rooms

---

## Project Status

The core assignment features are complete:

- Real-time synchronization
- Room-based watch parties
- YouTube integration
- WebSocket communication using Socket.IO
- Role-based access control
- Backend permission validation
- Host participant management
- Text chat
- Host transfer
- AI Watch Assistant
- Public deployment
