const express = require('express');
const path = require('path');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;

// Serve all front-end files from /public
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // User joins a room
    socket.on('join', (room) => {
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
        // Notify the other peer that someone joined
        socket.to(room).emit('ready', socket.id);
    });

    // Relay any WebRTC signal (SDP or ICE)
    socket.on('signal', (data) => {
        console.log(`Signal from ${socket.id} to room ${data.room}`);
        socket.to(data.room).emit('signal', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start server
http.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
