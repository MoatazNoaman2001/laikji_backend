const { notifyReportChanged } = require('../helpers/helpers');

module.exports = (io) => {
    io.use(async (socket, next) => {
        // socket.handshake.query
        let ip = socket.request.connection.remoteAddress;
        console.log('[home io] new client:', 'IP:', ip ?? 'no-ip');
        // console.log(socket.handshake.query);

        next();
    }).on('connection', async (xclient) => {
        // console.log('[home io] welcome');
        xclient.on('send_reports_count', async (data) => {
            await notifyReportChanged();
        });
        // xclient.on('disconnect', async (data) => {
        //     console.log('[home io] disc');
        // });
    });
};
