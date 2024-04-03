import express, { Express, Response } from 'express'
import { MultiDbORM } from 'multi-db-orm'
import * as bodyParser from 'body-parser'
import session from 'express-session'
import { Utils } from '../../utils/Utils'
import { ApiResponse } from './model'
import _ from 'lodash'
import { AuthUser } from './model'
import { GoogleSigninConfig, GoogleSigninMiddleware } from './google-signin'
import jwt from 'jsonwebtoken'
export * from './model'

export function generateUserJwt(user: AuthUser, secret: string) {
    return jwt.sign(user, secret, { expiresIn: "7200s", algorithm: 'HS256' })
}

export function createAuthMiddleware(
    db: MultiDbORM,
    app: Express,
    skipAuthRoutes: string[] = [],
    loginUser?: (email: string, password: string, id?: string) => Promise<AuthUser | undefined>,
    saveUser?: (user: AuthUser, req: any, res: any) => Promise<AuthUser>,
    logLevel: 0 | 1 | 2 | 3 | 4 = 0,
    authMethodsConfig: {
        password?: {
            usePlainText: boolean
        },
        google?: {
            creds: GoogleSigninConfig,
            defaultSignInReturnUrl: string
        }
    } = {
            password: {
                usePlainText: false
            }
        }
) {
    if (!db) {
        throw new Error('db must not be non-null')
    }

    const authApp = express.Router()

    let secret = Utils.getKeySync('auth.secret')
    if (!secret) {
        secret = Utils.generateRandomID()
        Utils.logPlain(`"auth.secret" used by jwt signing and session signing not found in config.json. Using random: ${secret}`)
    }

    function isSessionInitialized() {
        const middleware = app._router.stack;
        for (const layer of middleware) {
            if (layer.handle && layer.handle.name === 'session') {
                return true;
            }
        }
        return false;
    }

    if (!isSessionInitialized()) {
        app.use(session({
            secret: secret,
            resave: false,
            saveUninitialized: false
        }));
    }


    skipAuthRoutes.push('/auth/login')
    skipAuthRoutes.push('/auth/google/*')
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
            let authorization: string = (req.headers['authorization'] || req.query.authorization) as string
            if (authorization) {
                authorization = authorization.split(" ")[0]
                //todo auth
                next()
            } else {
                res.status(401).send(ApiResponse.notOk(`Missing authorization in headers`))
            }

        }
    })


    const TABLE_USER = 'users'
    const PASSWORD_HASH_LEN = 20
    const hashPasswords = authMethodsConfig?.password?.usePlainText || false

    saveUser = saveUser || async function (user: AuthUser, _req: Express.Request, _res: Response): Promise<AuthUser> {
        await db.insert(TABLE_USER, user)
        delete user.password
        return user
    }

    loginUser = loginUser || async function loginUser(email: string, password: string, id?: string): Promise<AuthUser | undefined> {
        let hashPassword = Utils.generateHash(password, PASSWORD_HASH_LEN)
        if (hashPasswords) {
            hashPassword = password
        }
        let filter: any = {
            password: hashPassword
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
        //@ts-ignore
        let user: any = await loginUser(email, password, id)
        if (user) {
            Object.assign(user, body)
        } else {
            user = body
            if (_.isEmpty(user.email) || _.isEmpty(user.password)) {
                throw new Error('email, password cannot be empty')
            }
            if (!user.id) {
                user.id = Utils.generateUID(user.email)
            }
        }
        if (user.password && !hashPasswords) {
            user.password = Utils.generateHash(user.password, PASSWORD_HASH_LEN)
        }
        return (saveUser && await saveUser(user, req, res))
    }
    if (authMethodsConfig.password) {
        authApp.post('/auth/signup', async (req, res) => {
            signUpUser(req.body, req, res).then((user) => {
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
            let user = await loginUser(email, password, id)
            if (user) {
                res.send(ApiResponse.ok(user))
            } else {
                res.status(401).send(ApiResponse.notOk('User not found or the credentials are incorrect'))
            }
        })
    }

    if (authMethodsConfig.google) {
        async function saveAndRedirectUser(user: AuthUser, returnUrl: string, req: any, res: any) {
            let loggedInUser = await signUpUser(user, req, res) as AuthUser
            if (!res.headersSent) {
                let token = generateUserJwt(loggedInUser, secret)
                req.session.access_token = token
                returnUrl = Utils.appendQueryParam(returnUrl, 'access_token', token)
                res.redirect(returnUrl)
            }
        }
        authApp.all('google', GoogleSigninMiddleware(
            authMethodsConfig.google.creds,
            saveAndRedirectUser,
            authMethodsConfig.google.defaultSignInReturnUrl))

    }


    return authApp
}