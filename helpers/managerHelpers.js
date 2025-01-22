const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config(); //import and config dotenv to use .env file for secrets

function generateVerificationToken(userId) {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    return token;
}

async function sendPasswordResetEmail(email, token) {
    console.log('sendeing reset password');
    const resetUrl = `http://185.203.118.57:9600.com/admin/auth/reset-password?token=${token}`;
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    await transporter.sendMail({
        from: process.env.EMAIL_USERNAME,
        to: email,
        subject: 'إعادة تعيين كلمة المرور',
        html: `
            <p>مرحبًا،</p>
            <p>الرجاء الضغط على الرابط أدناه لإعادة تعيين كلمة المرور:</p>
            <a href="${resetUrl}">إعادة تعيين كلمة المرور</a>
            <p>إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد.</p>
        `,
    });
}
module.exports = { generateVerificationToken, sendPasswordResetEmail };
