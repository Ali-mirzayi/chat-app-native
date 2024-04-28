const express = require("express");
const app = express();
const http = require('http');
const server = http.createServer(app);
const cors = require("cors");
const PORT = 4000;
const { Server } = require("socket.io");
const multer = require('multer');
const upload = multer();
const { Expo } = require('expo-server-sdk')
const uniq = require('lodash.uniqby');

const socketIO = new Server(server, {
	maxHttpBufferSize: 1e8,
	cors: {
		origin: "*",
		methods: ["GET", "POST"]
	}
});

app.use(express.json({ extended: false }));
app.use(cors());

const expo = new Expo();

const generateID = () => Math.random().toString(36).substring(2, 10);
let chatRooms = [];
let users = [{ _id: '1', name: 'ali mirzaei', avatar: '' }];
let onlineUsers = [];
let ExpoPushToken = [];

let file = "";

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
			return
		} else if (!!chatRooms.find(e => e.users[0]._id === firstName && e.users[1]._id === secondName || e.users[0]._id === secondName && e.users[1]._id === firstName)) {
			return
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

	socket.on("isUserInRoom", (data) => {
		if (data.status === true) {
			socket.broadcast.emit("isUserInRoomResponse", { 'status': true, 'name': data.user });
		} else {
			socket.broadcast.emit("isUserInRoomResponse", { 'status': false, 'name': data.user })
		}
	})

	// set id and usename object exp: (res) == { 'id': 'adsxc213', 'name': 'ali'}
	socket.on("setSocketId", (res) => {
		onlineUsers.unshift(res);
		onlineUsers = uniq(onlineUsers, 'name');
	});

	socket.on("checkStatus", (contact) => {
		socketIO.emit("checkStatusResponse", { 'status': !!onlineUsers.find(e => e.name === contact)?.id, 'name': contact });
	});

	socket.on("disconnect", () => {
		onlineUsers = onlineUsers.filter(e => e.id !== socket.id);
		socket.disconnect(socket);
		console.log(`🔥: ${socket.id} user disconnected`);
	});
});

app.get("/api", (req, res) => {
	console.log('api called');
	return res.status(200).json(chatRooms);
});

app.post("/upload", upload.any(), (req, res) => {
	const uploadedFile = req.files;
	file = uploadedFile[0].buffer.toString('base64');
	const chunks = uploadedFile[0].size / 100000;
	// for()


	// res.send(uploadedFile[0].buffer.toString('base64'));
	res.end("ok")
});

app.post("/uploads", upload.any(), (req, res) => {
	console.log(req.files, 'files');
	console.log(req.file, 'file');
	res.end("ok");
});

app.post("/deleteUser", (req, res) => {
	console.log(req.body.name);
	users = users.filter(e => e._id !== req.body.id);
	chatRooms = chatRooms.filter(e => e.users[1]._id !== req.body.id && e.users[0]._id !== req.body.id);
});

app.post("/checkUserToAdd", (req, res) => {
	if (!!users.find(e => e.name === req.body.name)) {
		return res.status(400).json({ isOK: false })
	} else {
		users.unshift(req.body);
		console.log(users);
		return res.status(200).json({ isOK: true });
	}
});

app.post("/sendPushNotifications", async(req, res) => {
	const {name,message,token} = req.body;
	if (!Expo.isExpoPushToken(token)) {
		console.error(`Push token ${token} is not a valid Expo push token`);
		return res.status(400).end(`Push token ${token} is not a valid Expo push token`)
	  }
	let ticket = await expo.sendPushNotificationsAsync([{
		to: token,
		title: name,
		body: message,
	}]);
	console.log(ticket,'tickett');
	console.log(ticket[0].status,'statuss');
	return res.status(200).end(`Push token ${token} is success`)
});

app.get("/", (req, res) => {
	return res.status(200).send('welcoooooooooooooooooome');
});

server.listen(PORT, () => {
	console.log(`Server listening on ${PORT}`);
});