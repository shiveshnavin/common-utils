import express, { Express, Response, Request } from 'express'
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
import path from 'path'
import LoginPage from './login.html'

export * from './mail/mailer'
export * from './model'

export function generateUserJwt(
    user: AuthUser,
    secret: string,
    expiresInSec: number = 7200) {
    if (typeof user == 'object')
        user = JSON.parse(JSON.stringify(user))
    return jwt.sign(user, secret, { expiresIn: `${expiresInSec}s`, algorithm: 'HS256' })
}

export interface AuthMethodConfig {
    expiresInSec: number,
    mailer?: Mailer,
    password?: {
        changePasswordPath: string,
        usePlainText: boolean
    },
    google?: {
        creds: GoogleSigninConfig,
        defaultSignInReturnUrl: string
    }
}
/**
 * 
 * @param db Instance of MultiDbORM
 * @param app 
 * @param skipAuthRoutes 
 * @param sessionMiddlware See https://www.npmjs.com/package/express-session#compatible-session-stores
 * @param getUser 
 * @param saveUser 
 * @param logLevel 0 | 1 | 2 | 3 | 4
 * @param config 
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
        }
) {
    const TABLE_USER = 'auth_users'
    const TABLE_FORGOTPASSWORD = "forgot_password"
    const PASSWORD_HASH_LEN = 20
    const usePlainTextPassword = config?.password?.usePlainText || false

    if (!db) {
        throw new Error('db must not be non-null')
    }
    const sampleUser: AuthUser = {
        avatar: 'stringlarge',
        email: 'stringsmall',
        name: 'stringsmall',
        access_token: 'stringlarge',
        id: 'stringsmall',
        password: 'stringsmall'
    }
    db.create(TABLE_USER, sampleUser)
    if (!config.mailer) {
        let MailConfig = Utils.readFileToObject(path.join(__dirname, '../../../common-creds/semibit/mail.json'))

        config.mailer = new Mailer({
            ...MailConfig,
            app: 'Semibit',
            company: 'Semibit Technologies',
            instagram: "https://instagram.com/semibitin",
            website: "https://www.semibit.in",
        })
    }
    const authApp = express.Router()
    authApp.use(cookies())

    let secret = Utils.getKeySync('auth.secret')
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
    skipAuthRoutes.push('/auth/google/*')
    skipAuthRoutes.push('/auth/changepassword')
    skipAuthRoutes.push('/auth/forgotpassword')
    if (config.password) {
        skipAuthRoutes.push('/auth/signup')
    }
    authApp.use(bodyParser.urlencoded())
    authApp.use(bodyParser.json())
    authApp.use((req, res, next) => {
        if (skipAuthRoutes?.some((route) => {
            return route.includes("*") ?
                req.path.match(route) :
                req.path == route;
        })) {
            if (logLevel > 4) {
                Utils.logPlain('Skipping auth check for ', req.path)
            }
            next()
        } else {
            let authorization: string = (req.headers['authorization'] || req.query.authorization) as string || (req.cookies && req.cookies['access_token'])
            if (authorization) {
                let user = getUserFromAccesstoken(req)
                if (!user) {
                    return handleUnauthenticatedRequest(401, `Unauthorized`, req, res, next)
                }
                //@ts-ignore
                req.session.user = user
                const accessToken = getAccessTokenFromHeader(req)
                res.cookie('access_token', accessToken, {
                    maxAge: config.expiresInSec * 1000,
                    httpOnly: true,
                    secure: false,
                    path: '/',
                });
                res.setHeader('Set-Cookie', `access_token=${accessToken}; Expires=${new Date(Date.now() + config.expiresInSec * 1000).toUTCString()}; Secure; Path=/`);
                next()
            } else {
                return handleUnauthenticatedRequest(401, `Missing authorization in headers`, req, res, next)
            }

        }
    })


    function getAccessTokenFromHeader(req: any) {
        let authorization: string = (req.headers['authorization'] || req.query.authorization) as string || req.cookies['access_token']
        let [authorizationType, token] = authorization.split(" ")
        if (!(authorizationType?.toLocaleLowerCase().trim() == 'bearer')) {
            token = authorization
        }
        return token
    }
    function getUserFromAccesstoken(req: any) {
        let token = getAccessTokenFromHeader(req)
        try {
            let ok = jwt.verify(token, secret)
            if (!ok)
                return undefined
        } catch (e: any) {
            return undefined
        }

        let decoded = jwt.decode(token, {
            json: true,
            complete: true
        })
        return decoded?.payload
    }


    saveUser = saveUser || async function (user: AuthUser, _req: Express.Request, _res: Response): Promise<AuthUser> {
        await db.insert(TABLE_USER, user)
        delete user.password
        return user
    }

    getUser = getUser || async function getUser(email: string, id?: string): Promise<AuthUser | undefined> {

        let filter: any = {
        }
        if (email) {
            filter.email = email
        }
        if (id) {
            filter.id = id
        }
        const user = await db.getOne(TABLE_USER, filter)
        if (user != undefined) {
            return user
        }
        return undefined
    }

    async function signUpUser(body: AuthUser, req: any, res: any): Promise<AuthUser | undefined> {
        const { email, id } = body
        //@ts-ignore
        let user: any = await getUser(email, id)
        if (user) {
            Object.assign(user, body)
        } else {
            user = body
            if (!user.id) {
                user.id = Utils.generateUID(user.email)
            }
        }
        if (user.password && !usePlainTextPassword) {
            user.password = Utils.generateHash(user.password, PASSWORD_HASH_LEN)
        }
        return (saveUser && await saveUser(user, req, res))
    }


    //returns user data
    authApp.get('/auth/me', async (req, res, next) => {
        //@ts-ignore
        let user = req.session?.user
        if (!user) {
            user = getUserFromAccesstoken(req)
        }
        if (!user) {
            return handleUnauthenticatedRequest(401, 'Unauthorized', req, res, next)
        }
        res.send(ApiResponse.ok(user))
    })

    const LoginPageHtml = LoginPage(appname)
    authApp.get('/auth/login', async (req, res, next) => {
        res.send(LoginPageHtml)
    })
    authApp.get('/auth/signout', async (req, res, next) => {
        handleUnauthenticatedRequest(401, 'Logged out', req, res, next)
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
                }
            }

            if (_.isEmpty(req.body.email) || _.isEmpty(req.body.password)) {
                return res.status(400).send(ApiResponse.notOk('email, password cannot be empty'))
            }
            signUpUser(req.body, req, res).then((user) => {
                let token = generateUserJwt(user!, secret, config.expiresInSec)
                addAccessToken(res, token)
                user!.access_token = token
                delete user?.password
                if (!res.headersSent)
                    res.send(ApiResponse.ok(user))
            }).catch((e) => {
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
                let hashPassword = Utils.generateHash(password, PASSWORD_HASH_LEN)
                if (usePlainTextPassword) {
                    hashPassword = password
                }
                if (user.password == hashPassword) {
                    let token = generateUserJwt(user!, secret, config.expiresInSec)
                    addAccessToken(res, token)
                    if (req.query.returnUri)
                        res.redirect(req.query.returnUri as string)
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
            const link = 'http://' + host + config.password?.changePasswordPath + '?secret=' + secret;
            const user: AuthUser = await db.getOne(TABLE_USER, { email: email }) //check for email in db and returns whole user row, right side email is value and left is column name

            if (user == undefined) {
                return res.send(ApiResponse.ok("If you are registered with us , an email will be sent to reset the password "))
            }
            const emailObj = {
                id: user.id,
                email: email,
                link: link,
                linkExp: Date.now() + 10 * 60 * 1000,
                secret
            }
            await db.insert(TABLE_FORGOTPASSWORD, emailObj)
            res.send(ApiResponse.ok("If you are registered with us , an email will be sent to reset the password "))

            //send email
            config.mailer?.sendTextEmail(email, "Reset Password", emailObj.link)
        })

        //change password API
        authApp.post('/auth/changepassword', async (req, res) => {

            try {
                const newPassword = Utils.generateHash(req.body.newPassword, PASSWORD_HASH_LEN)
                const secretKey = req.body.secret

                const forgotpassword: ForgotPassword = await db.getOne(TABLE_FORGOTPASSWORD, { secret: secretKey })

                if (!forgotpassword) {
                    res.status(400).send(ApiResponse.notOk("Oops ! Looks like the password reset link has expired Please request a new one"))
                    return
                }
                const userId = forgotpassword.id

                if (checkLinkExpiry(forgotpassword)) {
                    await db.update(TABLE_USER, { id: userId }, { password: newPassword })
                    res.send(ApiResponse.ok("Password updated successfully !"))
                    await db.delete(TABLE_FORGOTPASSWORD, { id: userId })
                }
                else {
                    await db.delete(TABLE_FORGOTPASSWORD, { id: userId })
                    res.status(400).send(ApiResponse.notOk("Password link expired, Request a new one"))
                }
            }
            catch (e: any) {
                res.status(500).send(ApiResponse.notOk("Internal Server Error"))
            }

        })

        function checkLinkExpiry(forgotpassword: ForgotPassword): boolean {
            return parseInt(forgotpassword.linkExp) >= Date.now()

        }


    }

    //---------------- if sigup selected using google ----------------
    function addAccessToken(res: Response, token: string) {
        res.cookie('access_token', token)
        res.header('access_token', token)
    }

    if (config.google) {
        async function saveAndRedirectUser(user: AuthUser, returnUrl: string, req: any, res: any) {
            let loggedInUser = await signUpUser(user, req, res) as AuthUser
            if (!res.headersSent) {
                let token = generateUserJwt(loggedInUser, secret, config.expiresInSec)
                req.session.access_token = token
                returnUrl = Utils.appendQueryParam(returnUrl, 'access_token', token)
                addAccessToken(res, token)
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