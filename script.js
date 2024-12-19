const localVideo = document.getElementById("localVideo");
const videosContainer = document.getElementById("videos");
const peers = {}; // Store peer connections
const socket = new WebSocket("ws://45.198.13.48:3005");
let localStream;

// Step 1: Start local video and audio
async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;
  } catch (error) {
    console.error("Error accessing media devices:", error);
  }
}

startLocalStream();

// Step 2: WebSocket signaling
socket.onopen = () => {
  console.log("Connected to WebSocket server");
  socket.send(JSON.stringify({ type: "join" }));
};

socket.onmessage = async (event) => {
  try {
    let data;

    // Handle Blob data from WebSocket
    if (event.data instanceof Blob) {
      const text = await event.data.text(); // Convert Blob to text
      data = JSON.parse(text); // Parse JSON from text
    } else {
      data = JSON.parse(event.data); // Parse JSON directly if not a Blob
    }

    const { type, from, offer, answer, candidate } = data;

    switch (type) {
      case "join":
        handleNewJoin(from);
        break;
      case "offer":
        await handleOffer(from, offer);
        break;
      case "answer":
        await handleAnswer(from, answer);
        break;
      case "candidate":
        handleCandidate(from, candidate);
        break;
    }
  } catch (error) {
    console.error("Error handling message:", error);
  }
};

function handleNewJoin(from) {
  if (!peers[from]) {
    const peerConnection = createPeerConnection(from);
    peers[from] = peerConnection;

    // Create and send an offer
    peerConnection
      .createOffer()
      .then((offer) => peerConnection.setLocalDescription(offer))
      .then(() => {
        socket.send(
          JSON.stringify({
            type: "offer",
            to: from,
            offer: peers[from].localDescription,
          })
        );
      })
      .catch((error) => console.error("Error creating an offer:", error));
  }
}

async function handleOffer(from, offer) {
  const peerConnection = createPeerConnection(from);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.send(JSON.stringify({ type: "answer", to: from, answer }));
}

async function handleAnswer(from, answer) {
  if (peers[from]) {
    await peers[from].setRemoteDescription(new RTCSessionDescription(answer));
  }
}

function handleCandidate(from, candidate) {
  if (peers[from]) {
    peers[from]
      .addIceCandidate(new RTCIceCandidate(candidate))
      .catch((error) => {
        console.error("Error adding ICE candidate:", error);
      });
  }
}

// Step 3: Create a new peer connection
function createPeerConnection(id) {
  const peerConnection = new RTCPeerConnection();

  // Add local stream tracks
  localStream
    .getTracks()
    .forEach((track) => peerConnection.addTrack(track, localStream));

  // Handle incoming remote streams
  peerConnection.ontrack = (event) => {
    const [remoteStream] = event.streams;
    addVideoStream(id, remoteStream);
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.send(
        JSON.stringify({
          type: "candidate",
          to: id,
          candidate: event.candidate,
        })
      );
    }
  };

  // Handle connection state changes
  peerConnection.onconnectionstatechange = () => {
    if (peerConnection.connectionState === "disconnected") {
      removeVideoStream(id);
      delete peers[id];
    }
  };

  return peerConnection;
}

// Step 4: Manage video streams
function addVideoStream(id, stream) {
  if (document.getElementById(id)) return; // Avoid duplicates
  const video = document.createElement("video");
  video.id = id;
  video.autoplay = true;
  video.srcObject = stream;
  videosContainer.appendChild(video);
}

function removeVideoStream(id) {
  const video = document.getElementById(id);
  if (video) {
    video.remove();
  }
}
