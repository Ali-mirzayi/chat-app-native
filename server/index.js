const express = require("express");
const app = express();
const http = require("http").Server(app);
const https = require("http").createServer(app);
const cors = require("cors");
const PORT = 4000;
const { Server } = require("socket.io");
const socketIO = new Server(https, {
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
let users = ['ali mirzaei'];
function same(arr1, arr2) {
	if (arr1.length !== arr2.length) {
		return false;
	}
	const sortedArr1 = arr1.slice().sort();
	const sortedArr2 = arr2.slice().sort();
	for (let i = 0; i < sortedArr1.length; i++) {
		if (sortedArr1[i] !== sortedArr2[i]) {
			return false;
		}
	}
	return true;
};

function cleanUpJson(arr) {
	return arr.filter((arr, index, self) => (
		index === self.findIndex((t) => (t.save === arr.save && t.State === arr.State))));
}

socketIO.on("connection", (socket) => {
	console.log(`⚡: ${socket.id} user just connected!`);
	socket.on("createUser", (user) => {
		const { username, hour, mins } = user;
		users.unshift(username);
		if (!chatRooms.find(e=>e.id === "aliismirzaei")){
			chatRooms.unshift({ id: "aliismirzaei", users: ["ali mirzaei", username], messages: [{ id: "mirzaeiMessage", text: "Hello and Welcome", user: "ali mirzaei", time: `${hour}:${mins}` }] });
		}
	});
	

	socket.on("findUser", (name) => {
		const { user, search } = name;
		// first filter just filter user who is host and second for search
		let result = users.filter(e => e != user).filter(e => e.includes(search));
		socket.emit('findUser', result);
		console.log(result, 'findUser');
	});

	// let Trooms = [
	// 	{
	// 	  id: '2qa2hpn5',
	// 	  users: [ 'ali', 'amir' ],
	// 	  messages: []
	// 	},
	// 	{
	// 	  id: 'fzs2ok5b',
	// 	  users: [ 'ali', 'hamid' ],
	// 	  messages: []
	// 	},
	// 	{
	// 	  id: 'aea9hm6z',
	// 	  users: [ 'reza', 'ali' ],
	// 	  messages: []
	// 	},
	// 	{
	// 	  id: 'aea9hm6z',
	// 	  users: [ 'hamid', 'reza' ],
	// 	  messages: []
	// 	}
	//   ];

	//   let b = [ 'hamid', 'reza' ]

	//   console.log(Trooms.find(e=>same(e.users,b)).id);

	socket.on("createRoom", (names) => {
		// integration this 2 connections with one if (&&)
		if (names[0] == names[1]) {
			return
		} else if (!!chatRooms.find(e => same(e.users, names))) {
			return
		}
		const id = generateID();
		socket.join(id);
		chatRooms.unshift({ id: id, users: [...names], messages: [] });
		// console.log(cleanUpJson(chatRooms),'roomslist');
		socket.emit("roomsList", chatRooms);
		console.log("created room", chatRooms);
	});

	socket.on("findRoom", (names) => {
		let result = chatRooms.find(e => same(e.users, names));
		socket.emit("foundRoom", result);
	});

	socket.on("newMessage", (data) => {
		const { names, message, user, timestamp } = data;
		// { id: "aliismirzaei", users:["ali mirzaei",username], messages: [{id: "mirzaeiMessage",text: "Hello and Welcome",user:"ali mirzaei",time: `${hour}:${mins}`}]}
		let result = chatRooms.find(e => same(e.users, names));
		console.log({ "chatRooms": chatRooms, "names": names });
		const newMessage = {
			id: generateID(),
			text: message,
			user,
			time: `${timestamp.hour}:${timestamp.mins}`,
		};
		console.log("New Message", newMessage);
		console.log("result", result);
		socket.to(result.id).emit("roomMessages", newMessage);
		result.messages.push(newMessage);
		// socket.emit("roomsList", chatRooms);
		socket.emit("roomMessages", result.messages);
	});

	socket.on("disconnect", () => {
		socket.disconnect(socket);
		console.log(`🔥: ${socket.id} user disconnected`);
	});
});

app.get("/api", (req, res) => {
	console.log('api called');
	// console.log(cleanUpJson(chatRooms),'api');
	return res.status(200).json(chatRooms);
});

app.get("/", (req, res) => {
	return res.status(200).send('welcoooooooooooooooooome');
});

https.listen(PORT, () => {
	console.log(`Server listening on ${PORT}`);
});