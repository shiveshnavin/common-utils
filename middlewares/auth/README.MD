# Auth middleware

### Installation

Make sure to install following dependencies:

```
npm install jsonwebtoken
```

### Hosting

```js
app.use(
  createAuthMiddleware(
    db,
    app,
    ["_expo*", "assets*", "favicon.ico"],
    sessionMiddleware,
    undefined, // override getUser function
    undefined, // override saveUser function
    undefined, // log level
    {
      expiresInSec: 2 * 365 * 24 * 3600, // AuthMethodConfig
    },
    (stats, reason, req, res, next) => {
      // Override the unauthenticated request handler
      let returnUri = encodeURIComponent(
        `${req.protocol}://${req.get("host")}${req.originalUrl}`
      );
      if (req.originalUrl?.indexOf("/auth/login") > -1) {
        res.redirect(req.originalUrl);
      } else {
        res.redirect("/auth/login?returnUri=" + returnUri);
      }
    }
  )
);
```
