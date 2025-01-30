const helpers = require('../helpers/helpers');

module.exports = async (req, res, next) => {
    try {
        const body = req.body;
        console.log('auth first ', JSON.stringify(body, null, 2));
        const action = parseInt(req.headers['action']);

        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            console.log('no token');
            return res.status(403).json({ ok: false, data: 'Token is required' });
        }

        const admin = await helpers.getAdminByToken(token);
        if (!admin) {
            return res.status(403).json({
                ok: false,
                data: 'Wrong token',
            });
        }
        console.log('print admin ', JSON.stringify(admin, null, 2));
        if (admin.permissions[action] === '0') {
            return res
                .status(200)
                .json({ ok: false, message: 'عذراً, لا تملك الصلاحية للقيام بهذا الإجراء' });
        }
        req.body = body;
        return next();
    } catch (error) {
        console.error(`Permission middleware error: ${error.message}`);
        res.status(500).json({ ok: false, message: 'Internal Server Error' });
    }
};
