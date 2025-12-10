// --- Set up the elements and Render connection ---
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const callButton = document.getElementById('callButton');
const roomIdDisplay = document.getElementById('room-id');

// The socket connects to the Render server
const socket = io(); 
let peerConnection;
const room = 'mya_super_secret_room'; // The shared chat channel name
roomIdDisplay.textContent = room;

// --- WebRTC Configuration ---
const config = {
    'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }]
};

// --- Step 1: Get Camera and Mic Access ---
callButton.onclick = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = stream;
        
        // Step 2: Set up the chat connection
        setupPeerConnection(stream);
        
        socket.emit('join', room);
        callButton.textContent = "Waiting for friend...";
        callButton.disabled = true;
    } catch (error) {
        console.error('Error accessing media devices.', error);
        alert('Cannot access camera/mic. Check phone permissions!');
    }
};

// --- Step 2 & 3: Handle the connection ---
function setupPeerConnection(stream) {
    peerConnection = new RTCPeerConnection(config);
    
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

    // When the friend's phone sends their stream, show it
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Send connection paths to the server
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', { room: room, candidate: event.candidate });
        }
    };
    
    // Listen for signals from the Render server
    socket.on('signal', async (data) => {
        if (data.sdp) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
            if (data.sdp.type === 'offer') {
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                socket.emit('signal', { room: room, sdp: peerConnection.localDescription });
            }
        } else if (data.candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    });
    
    // When a friend joins and is ready, start the call
    socket.on('ready', async (peerId) => {
        if (peerId !== socket.id) {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('signal', { room: room, sdp: peerConnection.localDescription });
            callButton.textContent = "Chatting! 🥳";
            callButton.disabled = true;
        }
    });
}
