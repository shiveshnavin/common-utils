import express, { Express, Response, Request, Router } from 'express'
//@ts-ignore
import { MultiDbORM } from 'multi-db-orm'
import * as bodyParser from 'body-parser'
//@ts-ignore
import session from 'express-session'
import { Utils } from '../../utils/Utils'
import { ApiResponse, ForgotPassword } from './model'
//@ts-ignore
import _ from 'lodash'
import { AuthUser } from './model'
import { GoogleSigninConfig, GoogleSigninMiddleware } from './google-signin'
//@ts-ignore
import jwt from 'jsonwebtoken'
import { Mailer } from './mail/mailer'
//@ts-ignore
import cookies from 'cookie-parser'
import LoginPage from './login.html'

// Extend express-session SessionData to include our user and access_token properties
//@ts-ignore
declare module 'express-session' {
    interface SessionData {
        user?: AuthUser
        access_token?: string
    }
}

export * from './mail/mailer'
export * from './model'

export type JwtPayloadOptions = {
    iss?: string,
    sub?: string,
    aud?: string,
    scope?: string,
}

export async function generateUserJwtDefault(
    payload: AuthUser & JwtPayloadOptions,
    secret: string,
    expiresInSec: number = 7200) {
    if (typeof payload == 'object')
        payload = JSON.parse(JSON.stringify(payload))
    return jwt.sign(payload, secret, { expiresIn: `${expiresInSec}s`, algorithm: 'HS256' })
}

export async function validateAndParseJwtDefault(token: string, secret?: string): Promise<AuthUser | null> {
    try {
        let ok = jwt.verify(token, secret)
        if (!ok)
            return null
    } catch (e: any) {
        return null
    }

    let decoded = jwt.decode(token, {
        json: true,
        complete: true
    })
    return decoded?.payload as AuthUser
}


export function getAccessTokenFromHeaderDefault(req: any) {
    return (req.headers['authorization']?.replace("Bearer ", "") || req.query.authorization) as string || (req.cookies && req.cookies['access_token'])
}

export function setAccessTokenInResponseDefault(req: any, res: any, token: string, expiresInSec: number) {
    if (req.session)
        req.session.access_token = token
    res.cookie('access_token', token, {
        maxAge: expiresInSec * 1000,
        httpOnly: true,
        secure: false,
        path: '/',
    });
    res.setHeader('access_token', token);
    res.setHeader('Set-Cookie', `access_token=${token}; Expires=${new Date(Date.now() + expiresInSec * 1000).toUTCString()}; Secure; Path=/`);
}

export interface AuthMethodConfig {
    expiresInSec: number,
    encryptJwtInCallbackUrl?: (req: Request, token: string) => string, // Double encrypt JWT when passed in callback urls using this key (for googlesignin)
    mailer?: Mailer,
    verifyEmailCallbackUrl: string
    password?: {
        secret?: string
        changePasswordPath: string
        usePlainText: boolean
    },
    google?: {
        creds: GoogleSigninConfig,
        defaultSignInReturnUrl: string
    },
    initDb?: () => Promise<void>
}

export enum AuthEvents {
    USER_CREATED,
    USER_UPDATED,
    USER_DELETED,
    USER_LOGIN,
    USER_LOGOUT,
    USER_FORGOT_PASSWORD,
    USER_RESET_PASSWORD
}


export const AUTH_TABLE_USER = 'auth_users'
export const AUTH_TABLE_FORGOTPASSWORD = "forgot_password"

export interface AuthMiddlewareOptions {
    db: MultiDbORM,
    app: Express,
    skipAuthForRoutes: string[],
    config: AuthMethodConfig,
    logLevel: 0 | 1 | 2 | 3 | 4,
    sessionMiddleware?: (config: any) => any,
    getUser?: (email: string, id?: string) => Promise<AuthUser | undefined>,
    saveUser?: (user: AuthUser, req: any, res: any) => Promise<AuthUser>,
    handleUnauthenticatedRequest?: (
        status: number,
        reason: string,
        req: Request,
        res: Response,
        next: Function) => void,
    logger?: { debug: (...params) => void, error: (...params) => void, info: (...params) => void, warn: (...params) => void, },
    onEvent?: (eventName: AuthEvents, data: any) => void,
    generateUserJwt?: (
        payload: AuthUser & JwtPayloadOptions,
        secret?: string,
        expiresInSec?: number) => Promise<string>,
    validateAndParseJwt?: (token: string, secret?: string) => Promise<AuthUser | null>,
    getAccessTokenFromHeader?: (req: any) => string,
    setAccessTokenInResponse?: (req: any, res: any, token: string, expiry: number) => void,
}
export function createAuthMiddlewareV2(config: AuthMiddlewareOptions): Router {
    return createAuthMiddleware(
        config.db,
        config.app,
        config.skipAuthForRoutes,
        config.sessionMiddleware,
        config.getUser,
        config.saveUser,
        config.logLevel,
        config.config,
        config.handleUnauthenticatedRequest,
        config.logger,
        config.onEvent,
        config.generateUserJwt,
        config.validateAndParseJwt,
        config.getAccessTokenFromHeader,
        config.setAccessTokenInResponse
    )
}


/**
 * @param db Instance of MultiDbORM
 * @param app 
 * @param skipAuthRoutes 
 * @param sessionMiddlware See https://www.npmjs.com/package/express-session#compatible-session-stores
 * @param getUser 
 * @param saveUser 
 * @param logLevel 0 | 1 | 2 | 3 | 4
 * @param config if your app's config.json dosent contain auth.secret but you are passing config.google.creds.private_key then the private_key will be used to sign the jwts
 * @param handleUnauthenticatedRequest
 * @param logger
 * @param onEvent Must never throw an error !
 * @returns 
 */
export function createAuthMiddleware(
    db: MultiDbORM,
    app: Express,
    skipAuthRoutes: string[] = [],
    sessionMiddlware?: (config: any) => any,
    getUser?: (email: string, id?: string) => Promise<AuthUser | undefined>,
    saveUser?: (user: AuthUser, req: any, res: any) => Promise<AuthUser>,
    logLevel: 0 | 1 | 2 | 3 | 4 = 0,
    config: AuthMethodConfig = {
        expiresInSec: 7200,
        verifyEmailCallbackUrl: "/",
        password: {
            usePlainText: false,
            changePasswordPath: "/changepassword"
        }
    },
    handleUnauthenticatedRequest: (
        status: number,
        reason: string,
        req: Request,
        res: Response,
        next: Function) => void = (
            status: number,
            reason: string,
            req: Request,
            res: Response,
            next: Function) => {
            res.status(status).send(ApiResponse.notOk(reason))
        },
    logger?: { debug: (...params) => void, error: (...params) => void, info: (...params) => void, warn: (...params) => void, },
    onEvent?: (eventName: AuthEvents, data: any) => void,
    generateUserJwt: (
        payload: AuthUser & JwtPayloadOptions,
        secret?: string,
        expiresInSec?: number) => Promise<string> = generateUserJwtDefault,
    validateAndParseJwt: (token: string, secret?: string) => Promise<AuthUser | null> = validateAndParseJwtDefault,
    getAccessTokenFromHeader: (req: any) => string = getAccessTokenFromHeaderDefault,
    setAccessTokenInResponse: (req: any, res: any, token: string, expiresInSec: number) => void = setAccessTokenInResponseDefault,
): Router {
    const PASSWORD_HASH_LEN = 20
    const usePlainTextPassword = config?.password?.usePlainText || false

    if (!db) {
        throw new Error('db must not be non-null')
    }
    if (!config.initDb) {
        config.initDb = async () => {
            const sampleUser: AuthUser = {
                avatar: 'stringlarge',
                email: 'stringsmall',
                name: 'stringsmall',
                access_token: 'stringlarge',
                id: 'stringsmall',
                created: 1234,
                identity: "stringsmall" as any,
                password: 'stringsmall',
                extrajson: 'stringlarge',
                status: 'stringsmall' as any,
            }
            await db.create(AUTH_TABLE_USER, sampleUser).catch(e => {

            })

            const sampleForgotPaswd: ForgotPassword = {
                id: 'stringsmall',
                email: 'stringsmall',
                link: 'stringlarge',
                linkExp: 'number',
                secret: 'stringsmall'
            }
            await db.create(AUTH_TABLE_FORGOTPASSWORD, sampleForgotPaswd).catch(e => {

            })
        }
    }
    config.initDb()

    if (!config.mailer) {
        let MailConfig = Utils.readFileToObject('mail.json')
        if (!MailConfig) {
            console.warn('Mail config not found, mails wont be sent. Ensure passing config.mailer or create a mail.json in the project root folder')
        }
        else
            config.mailer = new Mailer({
                ...MailConfig,
                app: 'MyCompany',
                company: 'MyCompany Technologies',
                instagram: "https://instagram.com/MyCompany",
                website: "https://www.MyCompany.in",
            })
    }
    const authApp = express.Router()
    authApp.use(cookies())

    let secret = config.password?.secret || Utils.getKeySync('auth.secret') || config.google?.creds?.web?.private_key
    let appname = Utils.getKeySync('appname') || 'Auth'

    if (!secret) {
        secret = Utils.generateRandomID()
        Utils.logPlain(`"auth.secret" which is used for jwt signing and session signing is not found in config.json. Using random: ${secret}`)
    }

    function isSessionInitialized() {
        const middleware = app._router?.stack || [];
        for (const layer of middleware) {
            if (layer.handle && layer.handle.name === 'session') {
                return true;
            }
        }
        return false;
    }

    if (!isSessionInitialized()) {
        app.use(sessionMiddlware || session({
            secret: secret,
            resave: false,
            saveUninitialized: false
        }));
    }


    skipAuthRoutes.push('/auth/login')
    skipAuthRoutes.push('/auth/logout')
    skipAuthRoutes.push('/auth/signout')
    skipAuthRoutes.push('/auth/google/*')
    skipAuthRoutes.push('/auth/changepassword')
    skipAuthRoutes.push('/auth/forgotpassword')
    skipAuthRoutes.push('/auth/verify-email')
    if (config.password) {
        skipAuthRoutes.push('/auth/signup')
    }
    authApp.use(bodyParser.urlencoded())
    authApp.use(bodyParser.json())
    authApp.use(async (req, res, next) => {
        let authorization: string = getAccessTokenFromHeader(req)
        let user;
        if (authorization) {
            user = await getUserFromAccesstoken(req)
            if (user)
                (req as any).session.user = user
        }
        if (skipAuthRoutes?.some((route) => {
            return route.includes("*") ?
                req.path.match(route) :
                req.path == route;
        })) {
            if (logLevel > 4) {
                Utils.log(req, 'Skipping auth check for ', req.path)
            }
            next()
        } else {
            if (authorization) {
                if (!user || user?.status == "INACTIVE") {
                    let msg = 'Unauthorized'
                    if (user?.status == "INACTIVE") {
                        msg = 'Account locked. Please contact support.'
                    }
                    if (req.cookies) {
                        for (const cookieName in req.cookies) {
                            res.clearCookie(cookieName, { path: '/' })
                        }
                    }
                    return handleUnauthenticatedRequest(401, msg, req, res, next)
                }
                const accessToken = getAccessTokenFromHeader(req)
                setAccessTokenInResponse(req, res, accessToken, config.expiresInSec)
                next()
            } else {
                return handleUnauthenticatedRequest(401, `Missing authorization in headers`, req, res, next)
            }

        }
    })

    async function getUserFromAccesstoken(req: any) {
        let token = getAccessTokenFromHeader(req)
        return await validateAndParseJwt(token, secret).catch(e => {
            Utils.log(req, 'Error validating jwt token. ' + e.message);
            return null;
        });;
    }


    saveUser = saveUser || CreateDefaultSaveUser(db)

    getUser = getUser || CreateDefaultGetUser(db)

    async function signUpUser(body: AuthUser, req: any, res: any): Promise<AuthUser | undefined> {
        const { email, id } = body
        let user: AuthUser = await getUser(email, id)
        let originalPassword = body.password
        let isUpdate = false
        if (body.password && !usePlainTextPassword) {
            body.password = Utils.generateHash(body.password, PASSWORD_HASH_LEN)
        }
        if (user) {
            isUpdate = true
            user.name = body.name
            user.password = body.password || user.password
            user.avatar = body.avatar
            Utils.log(req, 'User already exists, updating... ' + JSON.stringify(user))
        } else {
            user = body
            user.status = user.status || "UNVERIFIED"
            if (!user.id) {
                user.id = Utils.generateUID(user.email)
            }
            Utils.log(req, 'Creating new user...' + JSON.stringify(user))
        }
        user.created = user.created || Date.now()
        let newUser = (saveUser && await saveUser(user, req, res))
        if (onEvent) {
            onEvent(isUpdate ? AuthEvents.USER_UPDATED : AuthEvents.USER_CREATED, {
                ...user,
                password: originalPassword
            })
        }
        return newUser
    }


    //returns user data
    authApp.get('/auth/me', async (req, res, next) => {
        try {
            //@ts-ignore
            let user = req.session?.user as AuthUser
            if (!user) {
                user = await getUserFromAccesstoken(req)
            }
            if (user) {
                const userFromDb: AuthUser = await db.getOne(AUTH_TABLE_USER, { id: user.id })
                user = userFromDb
            }
            if (!user || user?.status == "INACTIVE") {
                {
                    let msg = 'Unauthorized'
                    if (user?.status == "INACTIVE") {
                        msg = 'Account locked. Please contact support.'
                    }
                    return handleUnauthenticatedRequest(401, msg, req, res, next)
                }
            }
            delete user.password
            res.send(ApiResponse.ok(user))
        } catch (e) {
            Utils.log(req, 'Error in /auth/me ' + e.message + ' at ' + e.stack)
            res.status(500).send(ApiResponse.notOk(e.message))
        }
    })

    const logout = async (req, res, next) => {
        onEvent && onEvent(AuthEvents.USER_LOGOUT, req.session?.user)
        if (req.cookies) {
            for (const cookieName in req.cookies) {
                res.clearCookie(cookieName, { path: '/' })
            }
        }
        res.clearCookie('access_token', {
            path: '/',
            httpOnly: true,
            secure: false
        })
        if (req.session?.destroy) {
            req.session.destroy(() => {
                res.redirect('/auth/login')
            })
        }
        else {
            req.session = null
            res.redirect('/auth/login')
        }
    }
    authApp.get('/auth/logout', logout)
    authApp.get('/auth/signout', logout)

    const LoginPageHtml = LoginPage(appname)
    authApp.get('/auth/login', async (req, res, next) => {
        res.send(LoginPageHtml)
    })

    // if password login is selected, then create signup api
    if (config.password) {
        authApp.post('/auth/signup', async (req, res, next) => {
            //@ts-ignore
            let preAuthenticated = req.session.user != undefined
            if (!preAuthenticated) {
                //@ts-ignore
                let user = await getUser(req.body.email, req.body.id)
                if (user) {
                    let password = req.body.password
                    if (!usePlainTextPassword) {
                        password = Utils.generateHash(password, PASSWORD_HASH_LEN)
                    }
                    if (user.password != password) {
                        return handleUnauthenticatedRequest(401, 'User credentials are incorrect', req, res, next)
                    }
                    if (user?.status == "INACTIVE") {
                        return handleUnauthenticatedRequest(401, 'Account locked. Please contact support.', req, res, next)
                    }
                }
            }

            if (_.isEmpty(req.body.email) || _.isEmpty(req.body.password)) {
                return res.status(400).send(ApiResponse.notOk('email, password cannot be empty'))
            }
            req.body.identity = "email"
            signUpUser(req.body, req, res).then(async (user) => {
                let token = await generateUserJwt(user!, secret, config.expiresInSec)
                setAccessTokenInResponse(req, res, token, config.expiresInSec)
                user!.access_token = token
                delete user?.password
                user.access_token = token
                if (!res.headersSent)
                    res.send(ApiResponse.ok(user))
            }).catch((e) => {
                Utils.log(req, 'Error is signup. ' + e.message)
                if (!res.headersSent)
                    res.send(ApiResponse.notOk(e.message))
            })
        })

        //login API
        authApp.post('/auth/login', async (req, res, next) => {
            const [email, password, id] = [req.body.email, req.body.password, req.body.id]
            //@ts-ignore
            let user = await getUser(email, id)

            if (user) {
                if (user?.status == "INACTIVE") {
                    return handleUnauthenticatedRequest(401, 'Account locked. Please contact support.', req, res, next)
                }
                let hashPassword = Utils.generateHash(password, PASSWORD_HASH_LEN)
                if (usePlainTextPassword) {
                    hashPassword = password
                }
                if (user.password == hashPassword) {
                    let token = await generateUserJwt(user!, secret, config.expiresInSec)
                    setAccessTokenInResponse(req, res, token, config.expiresInSec)
                    delete user.password
                    user.access_token = token
                    onEvent && onEvent(AuthEvents.USER_LOGIN, user)
                    if (req.query.returnUrl || req.query.returnUri || req.body.returnUrl)
                        res.redirect((req.query.returnUrl || req.query.returnUri || req.body.returnUrl) as string);
                    else
                        res.send(ApiResponse.ok(user))
                }
                else
                    return handleUnauthenticatedRequest(401, 'User not found or the credentials are incorrect', req, res, next)
            } else {
                return handleUnauthenticatedRequest(401, 'User not found or the credentials are incorrect', req, res, next)
            }
        })

        // forgot password API
        authApp.post('/auth/forgotpassword', async (req, res) => {
            const email = req.body.email
            let validateEmail = Utils.validateEmail(email)
            if (!validateEmail) {
                res.status(400).send(ApiResponse.notOk('Invalid Email'))
                return
            }
            const secret = Utils.generateRandomID(20)
            const host = req.get('host') || req.hostname;
            // const host = 'localhost:8081' 
            const link = 'http://' + host + config.password?.changePasswordPath + '?secret=' + secret;
            const user: AuthUser = await db.getOne(AUTH_TABLE_USER, { email: email }) //check for email in db and returns whole user row, right side email is value and left is column name

            if (user == undefined) {
                return res.send(ApiResponse.ok("If you are registered with us , an email will be sent to reset the password "))
            }
            const emailObj: ForgotPassword = {
                id: user.id,
                email: email,
                link: link,
                linkExp: String(Date.now() + 10 * 60 * 1000),
                secret
            }

            try {
                //inserting into Database - forgot password
                await db.delete(AUTH_TABLE_FORGOTPASSWORD, { id: emailObj.id })
                await db.insert(AUTH_TABLE_FORGOTPASSWORD, emailObj)

                res.send(ApiResponse.ok("If you are registered with us , an email will be sent to reset the password "))

                //send email
                await config.mailer?.sendResetPasswordMail(email, user.name, emailObj.link)
                onEvent && onEvent(AuthEvents.USER_FORGOT_PASSWORD, emailObj)
                Utils.log(req, 'forgotpassword mail sent to ' + email)
            } catch (e) {
                Utils.log(req, 'Error is forgotpassword. ' + e.message)
            }
        })

        // send verification email (initiate)
        authApp.post('/auth/verify-email', async (req, res) => {
            const email = req.body.email
            let validateEmail = Utils.validateEmail(email)
            if (!validateEmail) {
                res.status(400).send(ApiResponse.notOk('Invalid Email'))
                return
            }
            const secret = Utils.generateRandomID(20)
            const host = req.get('host') || req.hostname;
            const link = 'http://' + host + '/auth/verify-email?secret=' + secret;
            const user: AuthUser = await db.getOne(AUTH_TABLE_USER, { email: email })

            if (user == undefined) {
                // don't reveal whether email exists
                return res.send(ApiResponse.ok("If you are registered with us, a verification email will be sent."))
            }
            const emailObj: ForgotPassword = {
                id: user.id,
                email: email,
                link: link,
                linkExp: String(Date.now() + 10 * 60 * 1000),
                secret
            }

            try {
                await db.delete(AUTH_TABLE_FORGOTPASSWORD, { id: emailObj.id })
                await db.insert(AUTH_TABLE_FORGOTPASSWORD, emailObj)

                res.send(ApiResponse.ok("If you are registered with us, a verification email will be sent."))

                // send verification email
                await config.mailer?.sendVerificationMail(email, user.name, emailObj.link)
                onEvent && onEvent(AuthEvents.USER_UPDATED, { id: user.id, action: 'verify.email.sent' })
                Utils.log(req, 'verification mail sent to ' + email)
            } catch (e) {
                Utils.log(req, 'Error sending verification mail. ' + e.message)
            }
        })

        // handle verification link
        authApp.get('/auth/verify-email', async (req, res) => {
            try {
                const secretKey = (req.query.secret || req.body.secret || (req.params as any).secret) as string
                if (!secretKey) {
                    return res.redirect(((config.verifyEmailCallbackUrl) || '/') + '?status=FAILED&message=link_expired');
                }
                const forgotpassword: ForgotPassword = await db.getOne(AUTH_TABLE_FORGOTPASSWORD, { secret: secretKey })
                if (!forgotpassword) {
                    return res.redirect(((config.verifyEmailCallbackUrl) || '/') + '?status=FAILED&message=link_expired');

                }
                const userId = forgotpassword.id
                if (checkLinkExpiry(forgotpassword)) {
                    // mark user as active/verified
                    await db.update(AUTH_TABLE_USER, { id: userId }, { status: 'ACTIVE' })
                    onEvent && onEvent(AuthEvents.USER_UPDATED, { id: userId, action: 'verify.email.completed' })
                    await db.delete(AUTH_TABLE_FORGOTPASSWORD, { id: userId })
                    // redirect to login page if appropriate
                    res.redirect((config?.verifyEmailCallbackUrl || '/') + '?status=SUCCESS')
                } else {
                    await db.delete(AUTH_TABLE_FORGOTPASSWORD, { id: userId })
                    res.redirect((config?.verifyEmailCallbackUrl || '/') + '?status=FAILED&message=link_expired')
                }
            } catch (e: any) {
                Utils.log(req, 'Error in /auth/verify-email ' + e.message)
                res.redirect((config?.verifyEmailCallbackUrl || '/') + '?status=FAILED&message=internal_error')
            }
        })

        //change password API
        authApp.post('/auth/changepassword', async (req, res) => {

            try {
                const newPassword = usePlainTextPassword ? req.body.newPassword : Utils.generateHash(req.body.newPassword, PASSWORD_HASH_LEN)
                const secretKey = req.body.secret

                const forgotpassword: ForgotPassword = await db.getOne(AUTH_TABLE_FORGOTPASSWORD, { secret: secretKey })

                if (!forgotpassword) {
                    res.status(400).send(ApiResponse.notOk("Oops ! Looks like the password reset link has expired Please request a new one"))
                    return
                }
                const userId = forgotpassword.id

                if (checkLinkExpiry(forgotpassword)) {
                    await db.update(AUTH_TABLE_USER, { id: userId }, { password: newPassword })
                    onEvent && onEvent(AuthEvents.USER_RESET_PASSWORD, { id: userId, newPassword })
                    res.send(ApiResponse.ok("Password updated successfully !"))
                    await db.delete(AUTH_TABLE_FORGOTPASSWORD, { id: userId })
                }
                else {
                    await db.delete(AUTH_TABLE_FORGOTPASSWORD, { id: userId })
                    res.status(400).send(ApiResponse.notOk("Password link expired, Request a new one"))
                }
            }
            catch (e: any) {
                Utils.log(req, 'Error is changepassword. ' + e.message)
                res.status(500).send(ApiResponse.notOk("Internal Server Error"))
            }

        })

        // change password for authenticated user (current password required)
        authApp.post('/auth/updatepassword', async (req, res) => {
            try {
                const currentPassword = req.body.currentPassword
                const newPasswordRaw = req.body.newPassword
                if (!currentPassword || !newPasswordRaw) {
                    return res.status(400).send(ApiResponse.notOk('currentPassword and newPassword are required'))
                }

                // get logged in user from session or token
                let user: AuthUser | null = (req.session && req.session.user) ? req.session.user : null
                if (!user) {
                    const parsed = await getUserFromAccesstoken(req)
                    if (parsed) {
                        user = parsed
                    }
                }

                if (!user) {
                    return handleUnauthenticatedRequest(401, 'Unauthorized', req, res, () => { })
                }

                // fetch latest user from db
                const userFromDb: AuthUser = await db.getOne(AUTH_TABLE_USER, { id: user.id })
                if (!userFromDb) {
                    return handleUnauthenticatedRequest(401, 'User not found', req, res, () => { })
                }

                let hashedCurrent = currentPassword
                if (!usePlainTextPassword) {
                    hashedCurrent = Utils.generateHash(currentPassword, PASSWORD_HASH_LEN)
                }

                if (userFromDb.password !== hashedCurrent) {
                    return res.status(401).send(ApiResponse.notOk('Current password is incorrect'))
                }

                const newPassword = usePlainTextPassword ? newPasswordRaw : Utils.generateHash(newPasswordRaw, PASSWORD_HASH_LEN)

                await db.update(AUTH_TABLE_USER, { id: user.id }, { password: newPassword })
                onEvent && onEvent(AuthEvents.USER_UPDATED, { id: user.id })
                res.send(ApiResponse.ok('Password updated successfully'))
            } catch (e: any) {
                Utils.log(req, 'Error in /auth/updatepassword ' + e.message)
                res.status(500).send(ApiResponse.notOk('Internal Server Error'))
            }
        })

        function checkLinkExpiry(forgotpassword: ForgotPassword): boolean {
            return parseInt(forgotpassword.linkExp) >= Date.now()

        }


    }

    //---------------- if sigup selected using google ----------------
    if (config.google) {
        async function saveAndRedirectUser(user: AuthUser, returnUrl: string, req: any, res: any) {
            user.status = "ACTIVE"
            user.identity = "google"
            let loggedInUser = await signUpUser(user, req, res) as AuthUser
            if (!res.headersSent) {
                let token = await generateUserJwt(loggedInUser, secret, config.expiresInSec)
                setAccessTokenInResponse(req, res, token, config.expiresInSec)
                if (config.encryptJwtInCallbackUrl) {
                    returnUrl = Utils.appendQueryParam(returnUrl, 'access_token', config.encryptJwtInCallbackUrl(req, token))
                } else {
                    returnUrl = Utils.appendQueryParam(returnUrl, 'access_token', token)
                }
                res.redirect(returnUrl)
            }
        }
        const googleSigninRouter = GoogleSigninMiddleware(
            config.google.creds,
            saveAndRedirectUser,
            config.google.defaultSignInReturnUrl)
        authApp.use('/auth/google', googleSigninRouter)
    }

    return authApp
}


export const CreateDefaultSaveUser = (db: MultiDbORM) => (async function (user: AuthUser, _req: Express.Request, _res: Response): Promise<AuthUser> {

    await db.insert(AUTH_TABLE_USER, user)
        .catch(e => {
            if (e.message.includes("ER_DUP_ENTRY") || e.message.includes("already exists")) {
                return db.update(AUTH_TABLE_USER, { id: user.id }, user).catch(e => {
                    console.error(`Fatal Error updating user ${user.id} ` + e.message)
                })
            }
            console.error(`Fatal Error creating user ${user.id} ` + e.message)
        })
    delete user.password
    return user
})

export const CreateDefaultGetUser = (db: MultiDbORM) => (async function getUser(email: string, id?: string): Promise<AuthUser | undefined> {

    let filter: any = {
    }
    if (email) {
        filter.email = email
    }
    if (id) {
        filter.id = id
    }
    const user = await db.getOne(AUTH_TABLE_USER, filter)
    if (user != undefined) {
        return user
    }
    return undefined
})

export type AppInfo = {
    version?: string;
    platform?: string;
}

export function getAppInfo(req: Request): AppInfo {
    let appInfo: AppInfo = {}
    const version = req.headers['x-app-version']
    const platform = req.headers['x-app-platform']
    if (version && typeof version === 'string') {
        appInfo.version = version
    }
    if (platform && typeof platform === 'string') {
        appInfo.platform = platform
    }
    return appInfo
}