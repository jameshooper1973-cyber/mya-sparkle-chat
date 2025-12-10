const express = require('express');
const app = express();
const http = require('http').Server(app);
// Use the 'socket.io' library for real-time signaling
const io = require('socket.io')(http); 
const PORT = process.env.PORT || 3000; // Render will use its own PORT number

// Serve static files (html/css/js) from the same folder
app.use(express.static(__dirname));

// The server's main function starts here
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  socket.on('join', (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);
    // Notify the room that a new user is ready to connect
    socket.to(room).emit('ready', socket.id);
  });
  
  // This passes the WebRTC connection data between the two browsers
  socket.on('signal', (data) => {
    socket.to(data.room).emit('signal', data);
  });
});

// Render starts the server on the correct port
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
