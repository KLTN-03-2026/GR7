import { Router } from 'express'
import {
    changePassword, forgotPasswordController, loginController,
    logoutController, refreshTokenController, registerUserController, resetPassword,
    updateUserDetails, uploadAvatar, userDetails, userPoints, verifyEmailController,
    verifyForgotPasswordOtp, verifyPassword, getCustomerAnalytics, googleLoginController, facebookLoginController,
    getAdminUsers, createAdminUser, updateAdminUser,
    getDeletedAdminUsers, softDeleteAdminUser, restoreAdminUser, hardDeleteAdminUser
} from '../controllers/user.controller.js'
import auth from '../middleware/auth.js'
import { admin } from '../middleware/Admin.js'
import upload from './../middleware/multer.js';

const userRouter = Router()

userRouter.post('/register', registerUserController)
userRouter.post('/verify-email', verifyEmailController)
userRouter.post('/login', loginController)
userRouter.post('/google-login', googleLoginController)
userRouter.post('/facebook-login', facebookLoginController)
userRouter.get('/logout', auth, logoutController)
userRouter.put('/upload-avatar', auth, upload.single('avatar'), uploadAvatar)
userRouter.put('/update-user', auth, updateUserDetails)
userRouter.put('/forgot-password', forgotPasswordController)
userRouter.put('/verify-forgot-password-otp', verifyForgotPasswordOtp)
userRouter.put('/reset-password', resetPassword)
userRouter.post('/refresh-token', refreshTokenController)
userRouter.post('/verify-password', auth, verifyPassword)
userRouter.put('/change-password', auth, changePassword)
userRouter.get('/user-details', auth, userDetails)
userRouter.get('/user-points', auth, userPoints)

// Analytics route
userRouter.get('/analytics', auth, getCustomerAnalytics)

// ------- Admin Manage Users -------
userRouter.get('/admin-list', auth, admin, getAdminUsers)
userRouter.post('/admin-create', auth, admin, createAdminUser)
userRouter.put('/admin-update/:id', auth, admin, updateAdminUser)
userRouter.get('/admin-deleted-list', auth, admin, getDeletedAdminUsers)
userRouter.delete('/admin-soft-delete/:id', auth, admin, softDeleteAdminUser)
userRouter.put('/admin-restore/:id', auth, admin, restoreAdminUser)
userRouter.delete('/admin-hard-delete/:id', auth, admin, hardDeleteAdminUser)

export default userRouter