const uniq = require('lodash.uniqby');
const { socketIO, file, users, chatRooms, generateID, onlineUsers } = require(".");

socketIO.on("connection", (socket) => {
    console.log(`⚡: ${socket.id} user just connected!`);

    socket.on('sendMessage', (data) => {
        const { roomId, ...newMessage } = data;
        socketIO.in(roomId).emit('newMessage', newMessage);
    });

    socket.on('sendImage', (data) => {
        const { roomId, ...newMessage } = data;
        socketIO.in(roomId).emit('newMessage', { ...newMessage, image: file });
    });

    socket.on('sendVideo', (data) => {
        const { roomId, ...newMessage } = data;
        socketIO.in(roomId).emit('newMessage', { ...newMessage, video: file });
    });

    socket.on("findUser", (name) => {
        const { user, search } = name;
        // first filter just filter user who is host and second for search
        let result = users.filter(e => e._id !== user._id).filter(e => e.name.includes(search));
        socket.emit('findUser', result);
    });

    socket.on("createRoom", (names) => {
        // first condition for check user cant create room with self
        // second condition for check user cant create room !!again with another user
        const firstName = names[0]._id;
        const secondName = names[1]._id;
        if (firstName == secondName) {
            return;
        } else if (!!chatRooms.find(e => e.users[0]._id === firstName && e.users[1]._id === secondName || e.users[0]._id === secondName && e.users[1]._id === firstName)) {
            return;
        }
        const id = generateID();
        chatRooms.unshift({ id: id, users: names, messages: [] });
        socketIO.emit("roomsList", chatRooms);
    });

    socket.on("findRoom", (names) => {
        const firstName = names[0]._id;
        const secondName = names[1]._id;
        let result = chatRooms.find(e => e.users[0]._id === firstName && e.users[1]._id === secondName || e.users[0]._id === secondName && e.users[1]._id === firstName);
        socket.join(result.id);
        socket.emit("findRoomResponse", result);
    });

    socket.on("setStatus", (res) => {
        onlineUsers.unshift(res);
        onlineUsers = uniq(onlineUsers, 'name');
    });

    socket.on("checkStatus", (contact) => {
        console.log(onlineUsers, 'onlineUsers');
        console.log(onlineUsers.find(e => e.name === contact), 'filter1');
        // console.log(socket.rooms.has(`${onlineUsers.find(e => e.name === contact)?.id}`), 'filter2');
        console.log(!!onlineUsers.find(e => e.name === contact)?.id, 'stadus');
        socket.emit("checkStatusResponse", { 'status': !!onlineUsers.find(e => e.name === contact)?.id, 'name': contact });
    });

    // socket.on("checkStatus", (res) => {
    // 	const {contact , ...data } = res
    // 	onlineUsers.unshift(data);
    // 	onlineUsers = uniq(onlineUsers, 'name')
    // 	console.log(onlineUsers.find(e=>e.name === contact)?.id,'filter1');
    // 	console.log(onlineUsers.filter(e=>e.name === contact),'filter2');
    // 	socket.emit("checkStatusResponse", { 'status': socket.rooms.has(`${onlineUsers.find(e=>e.name === contact)?.id}`), 'name': data.name });
    // 	// socket.emit("checkStatusResponse", !!users.find(e=>e._id===id));
    // 	// console.log(socket.connected['nkidQAR9XNsTNPfqAAAH'],'connecteddd');
    // });
    socket.on("disconnect", () => {
        onlineUsers = onlineUsers.filter(e => e.id !== socket.id);
        socket.disconnect(socket);
        console.log(`🔥: ${socket.id} user disconnected`);
    });
});
