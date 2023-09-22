const express = require("express");
const app = express();
const http = require('http');
const server = http.createServer(app);
const cors = require("cors");
const PORT = 4000;
const { Server } = require("socket.io");
const isEqual = require('lodash.isequal');
// const uniqby = require('lodash.uniqby');
const uniqwith = require('lodash.uniqwith');
const socketIO = new Server(server, {
	maxHttpBufferSize: 1e8,
	cors: {
		origin: "*",
		// [
			// "http://localhost:3000",
			// "http://localhost:8081",
			// "http://localhost:4000",
			// "http://127.0.0.1:3000",
			// "http://127.0.0.1:8081",
			// "http://127.0.0.1:4000",
			// "http://10.0.2.2",
			// "http://10.0.2.2:8081",
			// "http://10.0.2.2:3000",
			// "http://10.0.2.2:4000",
			// "http://192.168.69.34:8081",
			// "http://192.168.69.34:3000",
			// "http://192.168.69.34:4000",
			// "http://135.125.113.241:3000",
			// "http://135.125.113.241:8081",
			// "http://135.125.113.241:4000",
			// "http://135.125.113.241",
		// ],
		methods: ["GET", "POST"]
	}
});

// app.use(express.urlencoded({ extended: true }));
app.use(express.json({ extended: false }));
app.use(cors());

const generateID = () => Math.random().toString(36).substring(2, 10);
let chatRooms = [];
let users = [{_id: '1',name: 'ali mirzaei',avatar: ''}];
console.log(users);
// let users = [{_id: '1',name: 'ali mirzaei',avatar: ''}, {_id: '2',name: 'amir bahador',avatar: ''}, {_id: '3',name: 'maryam bahadori',avatar: ''},  {_id: '4',name: 'negar',avatar: ''}, {_id: '5',name: 'ariya akhash',avatar: ''}];

// function cleanUpJson(arr) {
// 	return arr.filter((arr, index, self) => (
// 		index === self.findIndex((t) => (t.save === arr.save && t.State === arr.State))));
// }

// const room = [
// 	{ id: "ariya", users: [{_id: '6',name: 'ariya akhash',avatar: ''}, {_id: '5',name: 'ali',avatar: ''}], messages: []},
// 	{ id: "amirb", users: [{_id: '2',name: 'amir bahador',avatar: ''}, {_id: '5',name: 'ali',avatar: ''}], messages: []},
// ]
// { id: "aliismirzaei", users: [{_id: '1',name: "ali mirzaei",avatar: ""}, {_id: '5',name: 'ali',avatar: ''}], messages: [{_id: 'mirzaeiMessage',text: 'Hello and Welcome',createdAt: Date,user: {_id: '1',name: 'ali mirzaei',avatar: ''}}]},

// const names2 = [{_id: '4',name: 'negar',avatar: ''},{_id: '5',name: 'ali',avatar: ''}]

// console.log(uniqwith(room,v=> v.users[0]._id===names[0]._id || v.users[0]._id===names[1]._id).length===room.length);
// console.log(uniqwith(room,v=> v.users[0]._id===names2[0]._id));
// console.log();

socketIO.on("connection", (socket) => {
	console.log(`⚡: ${socket.id} user just connected!`);
	// socket.on("createUser", (user) => {
		// const { Date ,...username } = user;
		// 	users.unshift(username);
		// 	socket.emit("checkUser");
		// }
		// if (!chatRooms.find(e=>e.id === "aliismirzaei")){
		// 	chatRooms.unshift(
		// 		{ id: "aliismirzaei", users: [{_id: '1',name: 'ali mirzaei',avatar: ''}, username], messages: [{_id: 'mirzaeiMessage',text: 'Hello and Welcome',createdAt: Date,user: {_id: '1',name: 'ali mirzaei',avatar: ''}}]},
		// 		{ id: "amirb", users: [{_id: '2',name: 'amir bahador',avatar: ''}, username], messages: []},
		// 		{ id: "ariya", users: [{_id: '5',name: 'ariya akhash',avatar: ''}, username], messages: []},
		// 		);
		// }
	// });

	socket.on("findUser", (name) => {
		const { user, search } = name;
		// first filter just filter user who is host and second for search
		let result = users.filter(e => e._id !== user._id).filter(e => e.name.includes(search));
		socket.emit('findUser', result);
		// console.log(result, 'findUser');
	});

	socket.on("createRoom", (names) => {
		// first condition for check user cant create room with self
		// second condition for check user cant create room !!again with another user
		if (names[0]._id == names[1]._id) {
			return
		// }else if (uniqwith(chatRooms,v=>(isEqual(v.users,names) || isEqual(v.users,names.reverse()))).length!==chatRooms.length){
		}else if (chatRooms.find(e => isEqual(e.users,names) || isEqual(e.users,names.reverse()))){
			return
		}
		const id = generateID();
		socket.join(id);
		console.log(id,'id');
		chatRooms.unshift({ id: id, users: names, messages: [] });
		socket.emit("roomsList", chatRooms);
		console.log("created room", chatRooms);
	});

	socket.on("findRoom", (names) => {
		let result = chatRooms.find(e => isEqual(e.users,names) || isEqual(e.users,names.reverse()));
		// console.log("found room");
		socket.emit("findRoom", result.messages);
	});

	socket.on("newMessage", (data) => {
		const { names, ...message } = data;
		const result = chatRooms.find(e => isEqual(e.users,names) || isEqual(e.users,names.reverse()));
		const newMessage = {
			_id: message?._id,
			text: message?.text,
			createdAt: message?.createdAt,
			user: message?.user,
			image: message?.image,
			video: message?.video,
			audio: message?.audio,
			system: message?.system,
			sent: message?.sent,
			received: message?.received,
			pending: message?.pending,
			quickReplies: message?.quickReplies
		  }
		result.messages.push(newMessage);
		socket.emit("newMessage", result.messages);
		// socket.to(result.id).emit("newMessage", result.messages);
		// console.log(result.messages,'result');
		console.log(newMessage,'id newMessage');
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

app.post("/checkUser", (req, res) => {
	const { Date ,...username } = req.body;
	if(!!users.find(e=>e.name===username.name)){
		return res.status(400).json({isOK: false})
	}else{
		users.unshift(username);
		return res.status(200).json({isOK: true});
	}
});

app.get("/", (req, res) => {
	return res.status(200).send('welcoooooooooooooooooome');
});

server.listen(PORT, () => {
	console.log(`Server listening on ${PORT}`);
});