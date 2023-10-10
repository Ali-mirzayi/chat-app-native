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
const multer = require('multer');
const upload = multer();
// const fs = require('fs');
// const storage = multer.diskStorage({ 
// 	destination: 'uploads/',filename:function(req,file,cb){
// 	cb(null,'media')
// }});

// const storage = multer.diskStorage({
// 	destination:"/as",
// 	filename:function(req,file,cb){
// 			cb(null,'media')
// 		}
// });

// const upload = multer({dest:'uploads/'});
// const upload = multer({storage:storage});

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

app.use(express.json({ extended: false }));
app.use(cors());

const generateID = () => Math.random().toString(36).substring(2, 10);
let chatRooms = [];
let users = [{_id: '1',name: 'ali mirzaei',avatar: ''}];
let file="";

socketIO.on("connection", (socket) => {
	console.log(`⚡: ${socket.id} user just connected!`);
	socket.on('sendMessage', (data) => {
		const {roomId, ...newMessage} = data;
		socketIO.in(roomId).emit('newMessage', newMessage);
		// const result = chatRooms.find(e => e.id===roomId);
		// result.messages.unshift(newMessage);
		});
	
		socket.on('sendImage', (data) => {
			const {roomId, ...newMessage} = data;
			socketIO.in(roomId).emit('newMessage', {...newMessage,image:'data:image/jpeg;base64,'+file});
			// socket.to(roomId).emit('newMessage', {...newMessage,image:'data:image/jpeg;base64,'+file});
			// socketIO.to(socket.id).emit('newMessage', {...newMessage,image:'data:image/jpeg;base64,'+file});
			});

			socket.on('sendVideo', (data) => {
				const {roomId, ...newMessage} = data;
				console.log(file);
				socketIO.in(roomId).emit('newMessage', {...newMessage,video:'data:video/mp4;base64,'+file});
			});		

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
		const firstName = names[0]._id;
		const secondName = names[1]._id;
		if (firstName == secondName) {
			return
		}else if (!!chatRooms.find(e => e.users[0]._id===firstName && e.users[1]._id===secondName || e.users[0]._id===secondName && e.users[1]._id===firstName )){
			return
		}
		const id = generateID();
		chatRooms.unshift({ id: id, users: names, messages: [] });
		socketIO.emit("roomsList", chatRooms);
	});

	socket.on("findRoom", (names) => {
		const firstName = names[0]._id;
		const secondName = names[1]._id;
		let result = chatRooms.find(e => e.users[0]._id===firstName && e.users[1]._id===secondName || e.users[0]._id===secondName && e.users[1]._id===firstName );
		socket.join(result.id);
		socket.emit("findRoomResponse", result);
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

app.post("/upload", upload.any(),(req, res) => {
	const uploadedFile = req.files;
	file = uploadedFile[0].buffer.toString('base64');
	console.log(file);

	// res.send(uploadedFile[0].buffer.toString('base64'));
	res.end("ok")
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