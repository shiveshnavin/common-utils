export const EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device, initial-scale=1.0" />
    <title>Reset Password</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Playwrite+ES&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap");

      body {
        font-family: Arial, sans-serif;
        background-color: #f6f6f6;
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
      }

      .email-container {
        background-color: #ffffff;
        width: 600px;
        margin: 20px;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 0 100px rgba(0, 0, 0, 0.1);
      }

      .header {
        display: flex;
        flex-direction: column;
        text-align: center;
        padding-bottom: 20px;
        /* border-bottom: 1px solid #eeeeee; */
      }

      .header img {
        width: 50px;
        height: 50px;
      }
      .header h2 {
        padding-top: 15px;
        font-family: Montserrat, sans-serif;
        margin: 0;
        font-size: 24px;
        color: #333333;
      }
      .header p {
        margin: 5px 0 0;
        font-size: 14px;
        color: #777777;
      }

      .content {
        line-height: 1.4rem;
        padding: 20px 0;
        font-size: 16px;
        color: #333333;
      }
      .content p {
        margin: 15px 0;
        color: #032654;
      }
      a {
        color: #1a73e8;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
        color: rgb(42, 197, 122);
      }

      .button {
        /* display: inline-block; */
        padding: 10px 20px;
        margin: 20px 0;
        font-size: 16px;
        color: #140e0e;
        background-color: #e5e9ee;
        text-decoration: none;
        border-radius: 5px;

        display: inline-block;
        justify-content: center;
        align-items: center;
        align-content: center;
      }
      .footer {
        padding-top: 20px;
        border-top: 1px solid #eeeeee;
        text-align: center;
        font-size: 14px;
        color: #777777;
      }
      .footer img {
        width: 30px;
        height: 30px;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div
        class="header"
        style="
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          align-content: center;
        "
      >
        <div class="header">
          <img
            src="{{logo}}"
            alt="{{appname}} logo"
            style="align-self: center; height: 60px; width: 60px"
          />
          <h2
            style="align-self: center; padding-left: 2rem; padding-right: 2rem"
          >
            {{appname}}
          </h2>
        </div>
      </div>

      <div class="content">
        {{body}}
        <p><b>Regards,</b><br />Team {{appname}}</p>
      </div>
      <div class="footer">
        <p>Team {{appname}}</p>
        <p>© Copyright 2024</p>
        <p>
          <a href="{{privacy}}">Privacy Policy</a> |
          <a href="{{terms}}">Terms & Conditions</a>
        </p>
      </div>
    </div>
  </body>
</html>
`