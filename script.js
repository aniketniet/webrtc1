const localVideo = document.getElementById("localVideo");
const videosContainer = document.getElementById("videos");
const peers = {}; // Store peer connections
const socket = new WebSocket("ws://45.198.13.48:3005");
let localStream;

// Step 1: Get local video and audio
async function startLocalStream() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  localVideo.srcObject = localStream;
}

startLocalStream();

// Step 2: Handle WebSocket signaling
socket.onmessage = async (event) => {
  const message = JSON.parse(event.data);
  const { type, from, offer, answer, candidate } = message;

  switch (type) {
    case "offer":
      await handleOffer(from, offer);
      break;
    case "answer":
      await peers[from].setRemoteDescription(new RTCSessionDescription(answer));
      break;
    case "candidate":
      peers[from].addIceCandidate(new RTCIceCandidate(candidate));
      break;
  }
};

// Step 3: Create a new connection for each user
async function handleOffer(from, offer) {
  const peerConnection = createPeerConnection(from);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.send(JSON.stringify({ type: "answer", to: from, answer }));
}

function createPeerConnection(id) {
  const peerConnection = new RTCPeerConnection();

  // Add local stream tracks to the peer connection
  localStream
    .getTracks()
    .forEach((track) => peerConnection.addTrack(track, localStream));

  // Add remote stream to the UI
  peerConnection.ontrack = (event) => {
    const [remoteStream] = event.streams;
    addVideoStream(id, remoteStream);
  };

  // Send ICE candidates to signaling server
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

  peers[id] = peerConnection;
  return peerConnection;
}

function addVideoStream(id, stream) {
  const video = document.createElement("video");
  video.id = id;
  video.autoplay = true;
  video.srcObject = stream;
  videosContainer.appendChild(video);
}

// Step 4: Send an offer when a new user connects
socket.onopen = () => {
  socket.send(JSON.stringify({ type: "join" }));
};

socket.onmessage = async (event) => {
  const message = JSON.parse(event.data);
  if (message.type === "join" && message.from !== socket.id) {
    const peerConnection = createPeerConnection(message.from);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.send(JSON.stringify({ type: "offer", to: message.from, offer }));
  }
};
