import express, { Express, Response } from 'express'
import { MultiDbORM } from 'multi-db-orm'
import * as bodyParser from 'body-parser'
//@ts-ignore
import session from 'express-session'
import { Utils } from '../../utils/Utils'
import { ApiResponse } from './model'
//@ts-ignore
import _ from 'lodash'
import { AuthUser } from './model'
import { GoogleSigninConfig, GoogleSigninMiddleware } from './google-signin'
//@ts-ignore
import jwt from 'jsonwebtoken'
import { Mailer } from './mail/mailer'
import MailConfig from '../../../common-creds/semibit/mail.json'
//@ts-ignore
import cookies from 'cookie-parser'

export * from './mail/mailer'
export * from './model'

export function generateUserJwt(
    user: AuthUser,
    secret: string,
    expiresInSec: string = "7200s") {
    if (typeof user == 'object')
        user = JSON.parse(JSON.stringify(user))
    return jwt.sign(user, secret, { expiresIn: expiresInSec, algorithm: 'HS256' })
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
    config: {
        expiresInSec: string,
        mailer?: Mailer,
        password?: {
            usePlainText: boolean
        },
        google?: {
            creds: GoogleSigninConfig,
            defaultSignInReturnUrl: string
        }
    } = {
            expiresInSec: "7200s",
            password: {
                usePlainText: false
            }
        }
) {
    if (!db) {
        throw new Error('db must not be non-null')
    }
    if (!config.mailer) {
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
    if (!secret) {
        secret = Utils.generateRandomID()
        Utils.logPlain(`"auth.secret" used by jwt signing and session signing not found in config.json. Using random: ${secret}`)
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
                    return res.status(401).send(ApiResponse.notOk(`Unauthorized`))
                }
                //@ts-ignore
                req.session.user = user
                next()
            } else {
                res.status(401).send(ApiResponse.notOk(`Missing authorization in headers`))
            }

        }
    })


    function getUserFromAccesstoken(req: any) {
        let authorization: string = (req.headers['authorization'] || req.query.authorization) as string || req.cookies['access_token']
        let [authorizationType, token] = authorization.split(" ")
        if (!(authorizationType?.toLocaleLowerCase().trim() == 'bearer')) {
            token = authorization
        }

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

    const TABLE_USER = 'users'
    const PASSWORD_HASH_LEN = 20
    const usePlainTextPassword = config?.password?.usePlainText || false

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

    authApp.get('/auth/me', async (req, res) => {
        //@ts-ignore
        let user = req.session?.user
        if (!user) {
            user = getUserFromAccesstoken(req)
        }
        if (!user) {
            return res.send(401)
        }
        res.send(ApiResponse.ok(user))
    })
    if (config.password) {
        authApp.post('/auth/signup', async (req, res) => {
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
                        return res.status(401).send(ApiResponse.notOk('User credentials are incorrect'))
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
                if (!res.headersSent)
                    res.send(ApiResponse.ok(user))
            }).catch((e) => {
                if (!res.headersSent)
                    res.send(ApiResponse.notOk(e.message))
            })
        })
        authApp.post('/auth/login', async (req, res) => {
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
                    res.send(ApiResponse.ok(user))
                }
                else
                    res.status(401).send(ApiResponse.notOk('User not found or the credentials are incorrect'))
            } else {
                res.status(401).send(ApiResponse.notOk('User not found or the credentials are incorrect'))
            }
        })
    }

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