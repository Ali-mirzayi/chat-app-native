const express = require("express");
const app = express();
const http = require('http');
const server = http.createServer(app);
const cors = require("cors");
const PORT = 4000;
var path = require('path');
const fs = require('fs');
const { Server } = require("socket.io");
const multer = require('multer');
const cron = require('node-cron');
let file = {};
const storage = multer.diskStorage({
	destination: 'uploads/',
	filename: function (req, file, cb) {
		// console.log(file, 'multer file')
		cb(null, Date.now() + path.extname(file.originalname)) //Appending extension
	}
});

const upload = multer({ storage });


// const ffmpegPath = "/usr/bin/ffmpeg";
// const ffmpeg = require("./node_modules/fluent-ffmpeg/index");
// ffmpeg.setFfmpegPath(ffmpegPath);


// use for tumbnail
const ffmpegPath = require("./node_modules/@ffmpeg-installer/ffmpeg/index").path;
// const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("./node_modules/fluent-ffmpeg/index");
ffmpeg.setFfmpegPath(ffmpegPath);

const sharp = require('sharp');

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
app.use('/uploads', express.static('uploads'));

const expo = new Expo();

const generateID = () => Math.random().toString(36).substring(2, 10);
let chatRooms = [];
let users = [{ _id: '1', name: 'ali mirzaei', avatar: '', token: 'ExponentPushToken[itsAli]' }];
let onlineUsers = [];

let filePath = "";

app.post("/upload", upload.any(), (req, res) => {
	const uploadedFile = req.files[0];
	filePath = uploadedFile.path;
	file = { filePath: uploadedFile.path, size: uploadedFile.size, mimType:uploadedFile.mimetype };

	console.log(uploadedFile,'/upload filename')
	res.end("ok");
});

socketIO.on("connection", (socket) => {
	console.log(`⚡: ${socket.id} user just connected!`);
	socket.emit("connected", socket.id);
	socket.on('sendMessage', (data) => {
		const { roomId, ...newMessage } = data;
		socket.in(roomId).emit('newMessage', newMessage);
		// socketIO.in(roomId).emit('newMessage', newMessage);
	});

	socket.on('sendImage', (data) => {
		const { roomId, ...newMessage } = data;
		fs.readFile(filePath, (err, data) => {
			if (err) {
				console.error(err);
				return res.status(500).send("Error reading file");
			};

			sharp(data).jpeg({ quality: 5 }).toBuffer()
				.then(reducedData => {
					const base64Data = Buffer.from(reducedData).toString('base64');
					socket.in(roomId).emit('newMessage', { ...newMessage, image: filePath, preView: base64Data });
				}).catch(err => {
					console.error(err);
					return res.status(500).send("Error processing image");
				});
		});
	});

	socket.on('sendVideo', async (data) => {
		const { roomId, ...newMessage } = data;
		if (filePath !== "") {
			const filename = `${Date.now()}.jpg`;
			ffmpeg({
				source: filePath,
			}).on('end', () => {
				// fs.readFile(filePath, (err, data) => {
				// 	if (err) {
				// 		console.error(err);
				// 		return res.status(500).send("Error reading file");
				// 	};
				// });
				sharp(`uploads/${filename}`).jpeg({ quality: 5 }).toBuffer()
					.then(reducedData => {
						const base64Data = Buffer.from(reducedData).toString('base64');
						socket.in(roomId).emit('newMessage', { ...newMessage, video: filePath, thumbnail: base64Data })
					}).catch(err => {
						console.error(err);
						return res.status(500).send("Error processing image");
					});
			}).takeScreenshots({
				filename,
				timemarks: [10],
				folder: "uploads/",
			});
		} else {
			console.log('Upload not finished yet');
		}
	});

	socket.on('sendFile', async (data) => {
		const { roomId, ...newMessage } = data;
		if (!!file?.filePath) {
			socket.in(roomId).emit('newMessage', { ...newMessage, file: file?.filePath, mimType:file?.mimType })
		} else {
			console.log('Upload not finished yet');
		}
	});

	socket.on("findUser", (name) => {
		const { user, search } = name;
		// first filter just filter user who is host and second for search
		let result = users.filter(e => e.name.includes(search)).filter(e => e.name !== user.name);
		// let result = users.filter(e => e._id !== user._id).filter(e => e.name.includes(search));
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
		try {
			socket.join(result.id);
		} catch (err) {
			console.log('error to join room', err)
		}
		socket.emit("findRoomResponse", result);
	});

	// set id and usename object exp: (res) == { 'id': 'adsxc213', 'name': 'ali', 'isUserInRoom': false}
	socket.on("setSocketId", (res) => {
		onlineUsers.unshift(res);
		onlineUsers = uniq(onlineUsers, 'name');
	});

	socket.on("isUserInRoom", (data) => {
		// const find = onlineUsers.find(e => e.name === data.user);
		if (data.status === true) {
			onlineUsers = onlineUsers.map((user) => {
				if (user.name === data.user) {
					return { ...user, isUserInRoom: true };
				} else {
					return user;
				}
			});
			// socket.broadcast.emit("isUserInRoomResponse", { 'status': true, 'name': data.user });
		} else {
			onlineUsers = onlineUsers.map((user) => {
				if (user.name === data.user) {
					return { ...user, isUserInRoom: false };
				} else {
					return user;
				}
			});
		}
		socket.broadcast.emit("isUserInRoomResponse", onlineUsers?.find(e => e.name === data.user).isUserInRoom)
	});

	socket.on("checkStatus", async (contact) => {
		const sockets = await socketIO.fetchSockets();
		const socketIds = sockets.map(socket => socket.id);
		const find = onlineUsers.find(e => e.name === contact);
		console.log(socketIds, 'socketIds');
		console.log(find, 'onlineUsers.find(e => e.name === contact)');
		console.log(socketIds?.find(e => e === find?.id), 'socketIds.find(e=>e===find)');
		socketIO.emit("checkStatusResponse", { 'status': find, 'name': contact });
	});

	socket.on("disconnect", () => {
		onlineUsers = onlineUsers.filter(e => e.id !== socket.id);
		socket.disconnect(socket);
		console.log(`🔥: ${socket.id} user disconnected`);
	});
});

app.get("/api", (req, res) => {
	return res.status(200).json(chatRooms);
});

// app.post("/upload", upload.any(), (req, res) => {
// 	const uploadedFile = req.files[0];
// 	filePath = uploadedFile.path;
// 	res.end("ok");
// });

app.post("/deleteUser", (req) => {
	users = users.filter(e => e._id !== req.body._id);
	chatRooms = chatRooms.filter(e => e.users[1]._id !== req.body._id && e.users[0]._id !== req.body._id);
});

app.post("/checkUserToAdd", (req, res) => {
	if (!!users.find(e => e.name === req.body.name)) {
		return res.status(400).json({ isOK: false })
	} else {
		users.unshift(req.body);
		// console.log(users);
		return res.status(200).json({ isOK: true });
	}
});

app.post("/sendPushNotifications", async (req, res) => {
	const { user, message, token, roomId } = req.body;
	console.log(req.body)
	if (!Expo.isExpoPushToken(token)) {
		console.error(`Push token ${token} is not a valid Expo push token`);
		return res.status(400).json({ data: `Push token ${token} is not a valid Expo push token` })
	}
	try {
		let ticket = await expo.sendPushNotificationsAsync([{
			to: token,
			title: user.name,
			body: message,
			ttl: 172800, //2d
			priority: "normal",
			data: { user, roomId }
		}]);
		return res.status(200).json({ status: ticket[0].status })
	} catch (err) {
		return res.status(400).json({ status: `Error NetWork error (no notif) ${err}` })
	}
});

app.post("/updateUser", async (req, res) => {
	const newUser = req.body.user;
	try {
		users = users.map(user => {
			if (user._id === newUser._id) {
				return newUser;
			} else {
				return user;
			}
		});
		return res.status(200).json({ status: `User is update ${newUser}` })
	} catch (err) {
		return res.status(400).kson({ status: `Error to Update User ${err}` })
	}
});

// Schedule a task to delete files older than a day
cron.schedule('0 0 * * *', () => {
	const directory = 'uploads/';
	console.log('firsttt')
	fs.readdir(directory, (err, files) => {
	  if (err) throw err;
  
	  for (const file of files) {
		const filePath = directory + file;
		const stat = fs.statSync(filePath);
		const now = new Date();
		const fileModifiedTime = new Date(stat.mtime);
  
		if (now - fileModifiedTime > 1000 * 60 * 60 * 24) {
		  fs.unlink(filePath, (err) => {
			if (err) throw err;
			console.log(`Deleted ${filePath}`);
		  });
		}
	  }
	});
  });

app.get("/", (_, res) => {
	return res.status(200).send('welcome version 1.0.2 mirzagram');
});

server.listen(PORT, () => {
	console.log(`Server listening on ${PORT}`);
});