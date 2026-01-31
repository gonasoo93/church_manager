const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

// 업로드 디렉토리 생성
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const profileDir = path.join(uploadDir, 'profiles');
if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
}

const attachmentDir = path.join(uploadDir, 'attachments');
if (!fs.existsSync(attachmentDir)) {
    fs.mkdirSync(attachmentDir, { recursive: true });
}

// Multer 설정 - 프로필 사진
const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, profileDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const profileUpload = multer({
    storage: profileStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('이미지 파일만 업로드 가능합니다 (jpeg, jpg, png, gif)'));
        }
    }
});

// Multer 설정 - 첨부 파일
const attachmentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, attachmentDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'attachment-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const attachmentUpload = multer({
    storage: attachmentStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

        if (extname) {
            return cb(null, true);
        } else {
            cb(new Error('허용되지 않는 파일 형식입니다'));
        }
    }
});

// 모든 라우트에 인증 필요
router.use(authenticateToken);

// 프로필 사진 업로드
router.post('/profile', profileUpload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '파일이 업로드되지 않았습니다' });
        }

        const Member = require('../models/Member');
        const memberId = req.body.member_id;

        if (!memberId) {
            // 업로드된 파일 삭제
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: '학생 ID가 필요합니다' });
        }

        // 기존 프로필 사진 삭제
        const member = await Member.findById(memberId);
        if (member && member.profile_photo) {
            const oldPhotoPath = path.join(uploadDir, member.profile_photo);
            if (fs.existsSync(oldPhotoPath)) {
                fs.unlinkSync(oldPhotoPath);
            }
        }

        // 프로필 사진 경로 저장
        const photoPath = 'profiles/' + req.file.filename;
        await Member.findByIdAndUpdate(memberId, { profile_photo: photoPath });

        res.json({
            message: '프로필 사진이 업로드되었습니다',
            filename: req.file.filename,
            path: photoPath,
            url: `/uploads/${photoPath}`
        });
    } catch (error) {
        console.error('프로필 사진 업로드 오류:', error);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다' });
    }
});

// 첨부 파일 업로드
router.post('/attachment', attachmentUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '파일이 업로드되지 않았습니다' });
        }

        const filePath = 'attachments/' + req.file.filename;

        res.json({
            message: '파일이 업로드되었습니다',
            filename: req.file.filename,
            originalname: req.file.originalname,
            path: filePath,
            url: `/uploads/${filePath}`,
            size: req.file.size
        });
    } catch (error) {
        console.error('파일 업로드 오류:', error);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다' });
    }
});

// 파일 삭제
router.delete('/:type/:filename', async (req, res) => {
    try {
        const { type, filename } = req.params;

        if (type !== 'profiles' && type !== 'attachments') {
            return res.status(400).json({ error: '잘못된 파일 타입입니다' });
        }

        const filePath = path.join(uploadDir, type, filename);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ message: '파일이 삭제되었습니다' });
        } else {
            res.status(404).json({ error: '파일을 찾을 수 없습니다' });
        }
    } catch (error) {
        console.error('파일 삭제 오류:', error);
        res.status(500).json({ error: '파일 삭제 중 오류가 발생했습니다' });
    }
});

module.exports = router;
