// client.js - fixed version

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const callButton = document.getElementById('callButton');
const roomIdDisplay = document.getElementById('room-id');

const socket = io();
let peerConnection = null;
let localStream = null;
const room = 'mya_super_secret_room';
roomIdDisplay.textContent = room;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Register socket listeners ONCE
socket.on('connect', () => {
  console.log('socket connected', socket.id);
});

socket.on('ready', async (peerId) => {
  console.log('ready from', peerId);
  // If someone else joined the room, create an offer (caller)
  if (peerId !== socket.id) {
    if (!peerConnection) {
      setupPeerConnection(localStream);
    }
    try {
      // createOffer -> setLocalDescription -> send to remote
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('signal', { room, sdp: peerConnection.localDescription });
      callButton.textContent = "Chatting! 🥳";
      callButton.disabled = true;
    } catch (err) {
      console.error('Failed to create/send offer', err);
    }
  }
});

socket.on('signal', async (data) => {
  // data may be { room, sdp } or { room, candidate }
  if (!peerConnection) {
    // create peerConnection lazily if we have localStream (or later after getUserMedia)
    setupPeerConnection(localStream);
  }

  try {
    if (data.sdp) {
      const sdp = data.sdp;
      console.log('Received SDP', sdp.type);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      if (sdp.type === 'offer') {
        // create and send answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { room, sdp: peerConnection.localDescription });
        callButton.textContent = "Chatting! 🥳";
        callButton.disabled = true;
      }
      // if it's an 'answer', setRemoteDescription already handled above
    } else if (data.candidate) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        // This can happen if candidate arrives before remote description; it's safe to ignore or log
        console.warn('addIceCandidate failed', err);
      }
    }
  } catch (err) {
    console.error('Error handling signal', err);
  }
});

// Button -> get media & join room
callButton.onclick = async () => {
  try {
    callButton.disabled = true;
    callButton.textContent = 'Starting...';

    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    // Create the peer connection and attach local tracks
    if (!peerConnection) setupPeerConnection(localStream);

    // Join the shared room (server will emit 'ready' to others in the room)
    socket.emit('join', room);
    callButton.textContent = 'Waiting for friend...';
  } catch (error) {
    console.error('Error accessing media devices.', error);
    alert('Cannot access camera/mic. Check permissions and try again.');
    callButton.disabled = false;
    callButton.textContent = 'Start a Sparkle Call';
  }
};

function setupPeerConnection(stream) {
  // If already exist, do nothing (or optionally close & recreate)
  if (peerConnection) return;

  peerConnection = new RTCPeerConnection(config);

  // Add local tracks (if we already have them)
  if (stream) {
    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream);
    });
  }

  // When we get a remote track, show it
  peerConnection.ontrack = (event) => {
    console.log('ontrack', event);
    remoteVideo.srcObject = event.streams[0];
  };

  // Gather ICE candidates and send to other peer
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { room, candidate: event.candidate });
    }
  };

  // Optional: when negotiation is needed (rare with explicit ready-flow)
  peerConnection.onnegotiationneeded = async () => {
    try {
      if (!peerConnection) return;
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('signal', { room, sdp: peerConnection.localDescription });
    } catch (err) {
      console.error('Negotiation error', err);
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
    if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
      callButton.textContent = 'Start a Sparkle Call';
      callButton.disabled = false;
    }
  };
}

// Clean up when closing the page
window.addEventListener('beforeunload', () => {
  try {
    if (peerConnection) peerConnection.close();
    socket.disconnect();
  } catch (e) {}
});
