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
		cb(null, Date.now() + path.extname(file.originalname)) //Appending extension
	}
});

const upload = multer({ storage });

// use for tumbnail on windows
// const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
// const ffmpeg = require("fluent-ffmpeg");
// ffmpeg.setFfmpegPath(ffmpegPath);

const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

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
let users = [
	{ _id: '1', name: 'ali mirzaei', avatar: '', token: 'ExponentPushToken[itsAli]' },
	{ _id: '2', name: 'Mohsen', avatar: '', token: 'ExponentPushToken[itsMohsen]' }
];

let onlineUsers = [];

let filePath = "";

app.post("/upload", upload.any(), (req, res) => {
	const uploadedFile = req.files[0];
	filePath = uploadedFile.path;
	file = { filePath: uploadedFile.path, size: uploadedFile.size, mimeType: uploadedFile.mimetype };
	console.log('File uploaded successfully')
	res.end("ok");
});

socketIO.on("connection", (socket) => {
	console.log(`⚡: ${socket.id} user just connected!`);
	socket.emit("connected", socket.id);

	socket.on("joinInRoom", (roomId) => {
		socket.join(chatRooms.find(e => e.id === roomId)?.id);
	});

	socket.on("joinInRooms", (id) => {
		let result = chatRooms.filter(e => e.users[0]._id !== id || e.users[1]._id !== id);
		result.forEach(e => {
			socket.join(e.id);
		});
	});

	socket.on('sendMessage', (data) => {
		socket.to(data.roomId).emit('chatNewMessage', data);
	});

	socket.on('sendImage', (data) => {
		const { roomId, ...newMessage } = data;
		fs.readFile(filePath, (err, data) => {
			if (err) {
				console.error("Error reading image", err);
			};

			sharp(data).jpeg({ quality: 5 }).toBuffer()
				.then(reducedData => {
					const base64Data = Buffer.from(reducedData).toString('base64');
					socket.to(roomId).emit('chatNewMessage', { ...newMessage, image: filePath, preView: base64Data, roomId });
				}).catch(err => {
					console.error("Error sharp image", err);
					socket.to(roomId).emit('chatNewMessage', { ...newMessage, image: filePath, preView: undefined, roomId });
				});
		});
	});

	socket.on('sendVideo', async (data) => {
		const { roomId, ...newMessage } = data;
		if (filePath !== "") {
			const filename = `${Date.now()}.jpg`;
			try {
				ffmpeg({
					source: filePath,
				}).on('end', () => {
					sharp(`uploads/${filename}`).jpeg({ quality: 5 }).toBuffer()
						.then(reducedData => {
							const base64Data = Buffer.from(reducedData).toString('base64');
							console.log('thumbnail,', filePath, 'video sended');
							socket.to(roomId).emit('chatNewMessage', { ...newMessage, video: filePath, thumbnail: base64Data, roomId });
						}).catch(err => {
							socket.to(roomId).emit('chatNewMessage', { ...newMessage, video: filePath, thumbnail: undefined, roomId });
							console.error(err, 'error creating base64 thumbnail');
						});
				}).on('error', (err) => {
					console.error(err, 'error creating thumbnail');
					socket.to(roomId).emit('chatNewMessage', { ...newMessage, video: filePath, thumbnail: undefined, roomId });
				}).takeScreenshots({
					filename,
					timestamps: ['20%'],
					folder: "uploads/",
					// timemarks: [2]
				});
			} catch (e) {
				console.log(e, 'error send thumbnail')
			}
		} else {
			console.log('Upload not finished yet');
		}
	});

	socket.on('sendFile', async (data) => {
		const { roomId, ...newMessage } = data;
		if (!!file?.filePath) {
			console.log('downloading file finished ...');
			socket.to(roomId).emit('chatNewMessage', { ...newMessage, file: file?.filePath, mimeType: file?.mimeType, roomId });
		} else {
			console.log('Upload not finished yet');
		}
	});

	socket.on('sendAudio', async (data) => {
		const { roomId, ...newMessage } = data;
		if (!!file?.filePath) {
			console.log('downloading file finished ...');
			socket.to(roomId).emit('chatNewMessage', { ...newMessage, audio: file?.filePath, roomId });
		} else {
			console.log('Upload not finished yet');
		}
	});

	socket.on("findUser", (name) => {
		const { user, search } = name;
		let result = users.filter(e => e.name.toLocaleLowerCase().includes(search)).filter(e => e.name !== user.name);
		socket.emit('findUser', result);
	});

	socket.on("createRoom", async ({ user, contact }) => {
		const firstName = user._id;
		const secondName = contact._id;
		console.log('socket.on("createRoom", { user, contact });')
		if (!!chatRooms.find(e => e.users[0]._id === firstName && e.users[1]._id === secondName || e.users[0]._id === secondName && e.users[1]._id === firstName)) {
			return;
		}
		const id = generateID();
		const newRoom = { id: id, users: [user, contact], messages: [] };
		chatRooms.unshift(newRoom);
		socket.join(id);

		socket.emit("createRoomResponse", { newRoom, contact });

		const contactSocketId = onlineUsers.find(e => e.userId === secondName)?.socketId;

		if (!!contactSocketId) { socketIO.to(contactSocketId).emit("newRoom", newRoom) }
	});

	socket.on("findRoom", (names) => {
		const { user, contact } = names;
		let result = chatRooms.find(e => e.users[0]._id === user._id && e.users[1]._id === contact._id || e.users[0]._id === contact._id && e.users[1]._id === user._id);
		if (!result?.id) {
			const firstName = user._id;
			const secondName = contact._id;
			if (!!chatRooms.find(e => e.users[0]._id === firstName && e.users[1]._id === secondName || e.users[0]._id === secondName && e.users[1]._id === firstName)) {
				return;
			}
			const id = generateID();
			const newRoom = { id: id, users: [user, contact], messages: [] };
			chatRooms.unshift(newRoom);
			socket.join(id);
	
			socket.emit("createRoomResponse", { newRoom, contact });
	
			const contactSocketId = onlineUsers.find(e => e.userId === secondName)?.socketId;
	
			if (!!contactSocketId) { socketIO.to(contactSocketId).emit("newRoom", newRoom) }
		} else {
			socket.emit("findRoomResponse", { result, contact });
		}
	});

	// set id and usename object exp: (res) == { 'socketId': 'adsxc213', 'userId': 'sadbcv', 'userRoomId': 'sadasdzxc'}
	socket.on("setSocketId", (res) => {
		onlineUsers.unshift(res);
		onlineUsers = uniq(onlineUsers, 'userId');
		socketIO.emit('userConnected', onlineUsers.map(e => e.userId));
	});

	socket.on("isUserInRoom", ({ userId, contactId, userRoomId }) => {
		onlineUsers = onlineUsers.map((user) => {
			if (user.userId === userId) {
				return { ...user, userRoomId: userRoomId };
			} else {
				return user;
			}
		});
		const userStatus = onlineUsers?.find(e => e.userId === userId);
		const contactStatus = onlineUsers?.find(e => e.userId === contactId);
		socketIO.to(contactStatus?.socketId).to(socket.id).emit("isUserInRoomResponse", userStatus?.userRoomId === contactStatus?.userRoomId)
	});

	socket.on("checkStatus", ({ contactId, userRoomId }) => {
		const find = onlineUsers?.find(e => e.userId === contactId);
		const isInRoom = find?.userRoomId === userRoomId
		socket.emit("checkStatusResponse", { 'status': !!find?.socketId, 'isInRoom': isInRoom });
		// socketIO.to(socket.id).emit("checkStatusResponse", { 'status': !!find?.socketId, 'isInRoom': isInRoom });
	});

	socket.on("disconnect", () => {
		onlineUsers = onlineUsers.filter(e => e.socketId !== socket.id);
		socketIO.emit('userDisconnected', onlineUsers.map(e => e.userId));
		socket.disconnect(socket);
		console.log(`🔥: ${socket.id} user disconnected`);
	});
});

app.post("/deleteUser", (req) => {
	users = users.filter(e => e._id !== req.body._id);
	chatRooms = chatRooms.filter(e => e.users[1]._id !== req.body._id && e.users[0]._id !== req.body._id);
});

app.post("/checkUserToAdd", (req, res) => {
	if (!!users.find(e => e.name.toLocaleLowerCase() === req.body.name.toLocaleLowerCase())) {
		return res.status(400).json({ isOK: false })
	} else {
		users.unshift(req.body);
		return res.status(200).json({ isOK: true });
	}
});

app.post("/sendPushNotifications", async (req, res) => {
	const { user, message, token, roomId } = req.body;
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
		return res.status(400).json({ status: `Error to Update User ${err}` })
	}
});

// Schedule a task to delete files older than a day
cron.schedule('0 0 * * *', () => {
	const directory = 'uploads/';
	console.log('midnight is come')
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
	return res.status(200).send('welcome version 1.2.0 mirzagram');
});

server.listen(PORT, () => {
	console.log(`Server listening on ${PORT}`);
});