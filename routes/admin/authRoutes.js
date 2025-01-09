// routes/auth.js
const express = require('express');
const User = require('../../models/registeredUserModal');
const router = express.Router();
const {
    generateVerificationToken,
    sendVerificationEmail,
} = require('../../helpers/managerHelpers');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check if the email already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'هذا الاسم موجود مسبقا' });
        }

        // Create a new user
        const newUser = new User({ username, password });
        await newUser.save();

        // Generate a verification token
        const token = generateVerificationToken(newUser._id);

        // Send a verification email
        await sendVerificationEmail(username, token);

        res.status(201).json({
            message: 'الرجاء تأكيد التسجيل باستخدام الرابط المرسل الى البريد المسجل',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: ' حدث خطأ ما' + error.toString() });
    }
});
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
router.get('/verify-email', async (req, res) => {
    const token = req.query.token;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        await User.findByIdAndUpdate(userId, { isEmailVerified: true });

        res.send('تم توثيق بريدك بنجاح!');
    } catch (error) {
        res.status(400).send('Invalid or expired token.');
    }
});

router.post('/reset-password', async (req, res) => {
    const token = req.body.token;
    const newPassword = req.body.password;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        // Hash the new password and update the user record
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.findByIdAndUpdate(userId, { password: hashedPassword });

        res.send('Password has been successfully reset.');
    } catch (error) {
        res.status(400).send('Invalid or expired token.');
    }
});

module.exports = router;
