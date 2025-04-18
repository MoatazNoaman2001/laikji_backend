const express = require('express');
const socket = require('socket.io');
const dbConfig = require('./helpers/dbConfig');
const pkg = require('./package.json');
const path = require('path');
const port = process.env.PORT;
const cron = require('node-cron');

const app = express();
const roomAdminMiddleware = require('./middlewares/roomAdminMiddleware');
const memberMiddleware = require('./middlewares/memberMiddleware');
const memberPrivateMiddleware = require('./middlewares/memberPrivateMiddleware');
const { getNowDateTime } = require('./helpers/tools');
const http = require('http');
const { backupRooms } = require('./helpers/roomBackup');

//#region if ssl enabled
// const https = require('https');
// const fs = require('fs');
// const path = require('path');

// const privateKey = fs.readFileSync(path.join(__dirname, 'certs', 'key.pem'), 'utf8');
// const certificate = fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem'), 'utf8');

// const serverS = https.createServer(
//     {
//         cert: certificate,
//         key: privateKey,
//     },
//     app,
// );
//#endregion

const server = http.createServer(app);

//***Midlewares****
app.use(
    require('cors')({
        origin: '*',
        PORT: '*',
        methods: '*',
    }),
);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static('public'));
app.use(express.json());

//***Routes Midlewares */
// Global Routes
app.use('/global', require('./routes/globalRoutes'));
app.use('/room', require('./routes/roomRoutes'));
app.use('/chat', require('./routes/chatRoutes'));
app.use('/test', require('./routes/testRoutes'));
app.use('/pages', require('./routes/pageRoutes'));
app.use('/:roomId', require('./routes/micRoutes'));

// Room Admin Routes
app.use('/room_admin/:room_id', roomAdminMiddleware, require('./routes/roomAdmin/roomRoutes'));
app.use('/room_cmd/:room_id', roomAdminMiddleware, require('./routes/roomAdmin/commandsRoutes'));
// Admin Routes

app.use('/admin/groups', require('./routes/admin/groupsRoutes'));
app.use('/admin/entericons', require('./routes/admin/enterIconsRoutes'));
app.use('/admin/emojis', require('./routes/admin/emojisRoutes'));
app.use('/admin/rooms', require('./routes/admin/roomsRoutes'));
app.use('/admin/members', require('./routes/admin/membersRoutes'));
app.use('/admin/users', require('./routes/admin/usersRoutes'));
app.use('/admin/spys', require('./routes/admin/spyRoutes'));
app.use('/admin/reports', require('./routes/admin/reportsRoutes'));
app.use('/admin/settings', require('./routes/admin/settingsRoutes'));
app.use('/admin/global', require('./routes/admin/globalRoutes'));
app.use('/admin/auth', require('./routes/admin/authRoutes'));

// Member Routes
app.use(
    '/member/:member_id',
    memberMiddleware,
    memberPrivateMiddleware,
    require('./routes/member/memberRoutes'),
);

app.use(
    '/public-member/:member_id',
    memberMiddleware,
    require('./routes/member/publicMemberRoutes'),
);

// Private Chat
app.use('/private-chat', require('./routes/privateChat/privateChatRoutes'));
app.use('/', (req, res) => {
    res.status(200).send({
        serverVersion: 'v1.4.0-beta',
        pkg: pkg.dependencies,
        date: getNowDateTime(),
    });
});

server.listen(port, () => {
    console.log(`We are online ${port}`);
    dbConfig();
});
cron.schedule(
    '0 0 * * *',
    () => {
        console.log('Running rooms backup...');
        backupRooms();
    },
    {
        timezone: 'Asia/Riyadh',
    },
);
const waiting_users = new Set();
const rooms_users = new Set();
const app_users = new Set();
const room_io = socket(server, {
    rejectUnauthorized: false,
    cors: {
        credentials: true,
    },
    maxHttpBufferSize: 1e8,
});

require('./socketHandlers/roomSocketHandler')(room_io);

const home_io = socket(server, {
    rejectUnauthorized: false,
    cors: {
        credentials: true,
    },
    path: '/home-io',
});

require('./socketHandlers/homeSocketHandler')(home_io);

global = {
    io: room_io,
    home_io: home_io,
    rooms_users,
    app_users,
    waiting_users,
    filters: new Set(),
};

require('./helpers/filterHelpers').initFilter();
