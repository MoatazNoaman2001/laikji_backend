// routes/auth.js
const express = require('express');
const User = require('../../models/registeredUserModal');
const router = express.Router();
const helpers = require('../../helpers/helpers');

// Login route
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user || password !== user.password) {
            return res.status(401).json({ message: 'خطأ في الاسم أو كلمة المرور' });
        }
        var accessToken = helpers.generateToken(user.roomUserRef);
        res.json({ accessToken, user });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// // Refresh token route
// router.post('/refresh', (req, res) => {
//     const { refreshToken } = req.cookies;
//     if (!refreshToken) return res.status(401).json({ message: 'No token provided' });

//     jwt.verify(refreshToken, process.env.JWT_SECRET, (err, user) => {
//         if (err) return res.status(403).json({ message: 'Token invalid' });

//         const newAccessToken = generateToken(
//             user,
//             process.env.JWT_SECRET,
//             process.env.JWT_EXPIRATION,
//         );
//         res.json({ accessToken: newAccessToken });
//     });
// });

module.exports = router;
