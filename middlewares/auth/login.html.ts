export default function LoginPage(appname?: string) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appname || 'Auth'} : Login</title>
    <style>
      body {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        margin: 0;
        font-family: Arial, sans-serif;
        background-color: #f0f0f0;
      }
      .login-container {
        background-color: #fff;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        text-align: center;
        width: 300px;
      }
      .login-container h1 {
        margin-bottom: 20px;
      }
      .login-container label {
        display: block;
        margin-bottom: 5px;
        text-align: left;
      }
      .login-container input {
        width: 100%;
        padding: 10px;
        margin-bottom: 15px;
        border: 1px solid #ccc;
        border-radius: 5px;
        box-sizing: border-box;
      }
      .login-container button {
        width: 100%;
        padding: 10px;
        background-color: #4caf50;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
      }
      .login-container button:hover {
        background-color: #45a049;
      }
    </style>
  </head>
  <body>
    <div class="login-container">
      <h4>Login ${appname ? 'to ' + appname : ''}</h4>
      <form method="POST">
        <input type="hidden" id="returnUrl" name="returnUrl" value="/" hidden />
        <label for="email">Email:</label>
        <input type="email" id="email" name="email" required />
        <label for="password">Password:</label>
        <input type="password" id="password" name="password" required />
        <button type="submit">Login</button>
      </form>
    </div>
  </body>
</html>
`
}