const express = require("express");
const app = express();
const http = require("http").Server(app);
const https = require("http").createServer(app);
const cors = require("cors");
const PORT = 4000;
const {Server} = require("socket.io");
const socketIO = new Server(https,{
	cors: {
		origin: [
				    "http://localhost:3000",
				    "http://localhost:8081",
				    "http://localhost:4000",
			        "http://127.0.0.1:3000",
				    "http://127.0.0.1:8081",
				    "http://127.0.0.1:4000",
				    "http://10.0.2.2",
				    "http://10.0.2.2:8081",
					"http://10.0.2.2:3000",
					"http://10.0.2.2:4000",
				    "http://192.168.69.34:8081",
				    "http://192.168.69.34:3000",
				    "http://192.168.69.34:4000",
				    "http://135.125.113.241:3000",
				    "http://135.125.113.241:8081",
				    "http://135.125.113.241:4000",
				    "http://135.125.113.241",
				],
			methods: ["GET", "POST", "PUT", "PATCH"]
		}
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

const generateID = () => Math.random().toString(36).substring(2, 10);
let chatRooms = [];
let users = [];
socketIO.on("connection", (socket) => {
	console.log(`⚡: ${socket.id} user just connected!`);
	// socket.emit('connect', {message: 'a new client connected'});
	socket.on("createUser", (user) => {
		users.unshift(user);
		console.log(users);
	})
	
	socket.on("createRoom", (name) => {
		socket.join(name);
		chatRooms.unshift({ id: generateID(), name, messages: [] });
		socket.emit("roomsList", chatRooms);
	});

	socket.on("findUser", (name) => {
		console.log(name,'name');
		let result = users.filter((user) => user.includes(name));
		socket.emit('findUser', result);
	})

	socket.on("findRoom", (name) => {
		// console.log(chatRooms,'chatRoom');
		// console.log(name,'name');
		// console.log(chatRooms.filter((room) => room.name.includes(name)));
		let result = chatRooms.filter((room) => room.name.includes(name));
		// let result = chatRooms.filter((room) => room.id == id);
		socket.emit("foundRoom", result);
		// console.log("Messages Form", result[0].messages);
	});

	socket.on("newMessage", (data) => {
		const { room_id, message, user, timestamp } = data;
		let result = chatRooms.filter((room) => room.id == room_id);
		const newMessage = {
			id: generateID(),
			text: message,
			user,
			time: `${timestamp.hour}:${timestamp.mins}`,
		};
		console.log("New Message", newMessage);
		socket.to(result[0].name).emit("roomMessage", newMessage);
		result[0].messages.push(newMessage);

		socket.emit("roomsList", chatRooms);
		socket.emit("foundRoom", result[0].messages);
	});

	socket.on("disconnect", () => {
		socket.disconnect(socket);
		console.log(`🔥: ${socket.id} user disconnected`);
	});
});

app.get("/api", (req, res) => {
	console.log('api called');
	return res.status(200).json(chatRooms);
});

app.get("/", (req, res) => {
	return res.status(200).send('welcoooooooooooooooooome');
});

console.log(chatRooms);

https.listen(PORT, () => {
	console.log(`Server listening on ${PORT}`);
});