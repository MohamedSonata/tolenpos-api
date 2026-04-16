
import type { Core } from '@strapi/strapi';
import * as yup from 'yup';


const userUtils = ({ strapi }: { strapi: Core.Strapi }) => {

  return {

    async sanitizeUserForSocketIo(userData:any,socket:any){
      const contentType = strapi.contentType('plugin::users-permissions.user');
      const sanitizedUser = await strapi.contentAPI.sanitize.output(userData, contentType,{
        auth:{
          strategy:{
            name:socket.strategyName
          }
        }
      });
      return sanitizedUser;
    },

    async verificationCode(indentifier: any) {

      const code = await generateRandomNumberCode(6);
      const currentTimestamp = new Date();
      const endTimer = new Date();
      endTimer.setMinutes(currentTimestamp.getMinutes() + 15);
      return {
        indentifier: indentifier,
        verficationCode: code,
        startAt: currentTimestamp,
        endAt: endTimer.toISOString(),
      };
    },

    async modifyEmail(email) {
      // Check if the email contains only numbers
      if (/^\d+$/.test(email)) {
        // If it contains only numbers, concatenate with "phoneNumAlterDomain()"
        return email + phoneNumAlterDomain();
      } else {
        // If not, return the original email
        return email;
      }
    },

    async phoneNumAlterDomain() { return "@xefro.net" },

    async validateQuery(query, ctx) {
      const schema = strapi.getModel("plugin::users-permissions.user");
      const { auth } = ctx.state;

      return strapi.contentAPI.validate.query(query, schema, { auth });
    },

    async sanitizeQuery(query, ctx) {
      const schema = strapi.getModel("plugin::users-permissions.user");
      const { auth } = ctx.state;

      return strapi.contentAPI.sanitize.query(query, schema, { auth });
    },

    async sanitizeUser(query, ctx) : Promise<User> {
      const schema = strapi.getModel("plugin::users-permissions.user");
      const { auth } = ctx.state;
const user = await strapi.contentAPI.sanitize.output(query, schema, { auth });

      return user as User;
    },

    customEmailTemplate(tokenCode: String, userName: String) {

      return `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <title>Password Reset Request</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f4f4f9;
        margin: 0;
        padding: 0;
      }
      
      .container {
        width: 100%;
        max-width: 600px;
        margin: 40px auto;
        padding: 20px;
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      
      .header {
        text-align: center;
        padding: 20px 0;
        background-color: #007bff;
        border-radius: 12px 12px 0 0;
        color: #ffffff;
      }
      
      .header img {
        width: 80px;
        height: auto;
        border-radius: 50%;
      }
      
      .header h1 {
        font-size: 24px;
        margin-top: 10px;
      }
      
      .body {
        padding: 20px;
        text-align: left;
        color: #333333;
      }
      
      .body p {
        line-height: 1.6;
        font-size: 16px;
      }
      
      .code-box {
        background-color: #f4f4f9;
        border-left: 4px solid #007bff;
        padding: 15px;
        font-size: 18px;
        font-weight: bold;
        text-align: center;
        color: #333333;
        margin: 20px 0;
        border-radius: 8px;
      }
      
      .btn {
        display: inline-block;
        padding: 12px 25px;
        font-size: 16px;
        color: #ffffff;
        background-color: #007bff;
        text-align: center;
        border-radius: 6px;
        text-decoration: none;
        font-weight: bold;
        margin-top: 20px;
      }
      
      .btn:hover {
        background-color: #0056b3;
      }
      
      .footer {
        text-align: center;
        margin-top: 30px;
        padding: 20px;
        font-size: 14px;
        color: #777777;
        background-color: #f4f4f9;
        border-radius: 0 0 12px 12px;
      }
      
      a {
        color: #007bff;
        text-decoration: none;
      }
      
      a:hover {
        text-decoration: underline;
      }
    </style>
    </head>
    <body>
    <div class="container">
      <div class="header">
        <img src="https://img.freepik.com/free-vector/shield_78370-582.jpg?w=740&t=st=1700002334~exp=1700002934~hmac=0b51d71da4cf3f320a5af4ca32976b6f48c54f989f152c660187e2ba5d1d5d5a" alt="Mirror Xefro Logo">
        <h1>Password Reset Request</h1>
      </div>
    
      <div class="body">
        <p>Hi <strong>${userName}</strong>,</p>
        
        <p>We noticed you requested to reset your password. No worries.!</p>
        
        <p>Here’s your unique password reset code:</p>
        
        <div class="code-box">${tokenCode}</div>
        
        <p>Enter this code in the password reset page to continue. This code is valid for only <strong>15 minutes</strong>, so be sure to use it promptly.</p>
        
    
        
        <p>If you didn't request a password reset, you can safely ignore this email. Your account is still secure with us.</p>
        
        <p>Stay secure,</p>
        <p>The <strong>Mirror Xefro</strong> Team</p>
      </div>
      
      <div class="footer">
        <p>&copy; 2025 Mirror Xefro. All rights reserved.</p>
        <p>Need help? <a href="https://xefromirror.xefro.net/help">Contact Support</a></p>
      </div>
    </div>
    </body>
    </html>
    
      
    `},
    customConfirmationEmailTemplate(tokenCode: String, userName: String) {

      return `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <title>Confirmation Request</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f4f4f9;
        margin: 0;
        padding: 0;
      }
      
      .container {
        width: 100%;
        max-width: 600px;
        margin: 40px auto;
        padding: 20px;
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      
      .header {
        text-align: center;
        padding: 20px 0;
        background-color: #007bff;
        border-radius: 12px 12px 0 0;
        color: #ffffff;
      }
      
      .header img {
        width: 80px;
        height: auto;
        border-radius: 50%;
      }
      
      .header h1 {
        font-size: 24px;
        margin-top: 10px;
      }
      
      .body {
        padding: 20px;
        text-align: left;
        color: #333333;
      }
      
      .body p {
        line-height: 1.6;
        font-size: 16px;
      }
      
      .code-box {
        background-color: #f4f4f9;
        border-left: 4px solid #007bff;
        padding: 15px;
        font-size: 18px;
        font-weight: bold;
        text-align: center;
        color: #333333;
        margin: 20px 0;
        border-radius: 8px;
      }
      
      .btn {
        display: inline-block;
        padding: 12px 25px;
        font-size: 16px;
        color: #ffffff;
        background-color: #007bff;
        text-align: center;
        border-radius: 6px;
        text-decoration: none;
        font-weight: bold;
        margin-top: 20px;
      }
      
      .btn:hover {
        background-color: #0056b3;
      }
      
      .footer {
        text-align: center;
        margin-top: 30px;
        padding: 20px;
        font-size: 14px;
        color: #777777;
        background-color: #f4f4f9;
        border-radius: 0 0 12px 12px;
      }
      
      a {
        color: #007bff;
        text-decoration: none;
      }
      
      a:hover {
        text-decoration: underline;
      }
    </style>
    </head>
    <body>
    <div class="container">
      <div class="header">
        <img src="https://img.freepik.com/free-vector/shield_78370-582.jpg?w=740&t=st=1700002334~exp=1700002934~hmac=0b51d71da4cf3f320a5af4ca32976b6f48c54f989f152c660187e2ba5d1d5d5a" alt="Mirror Xefro Logo">
        <h1>Confirmation Request</h1>
      </div>
    
      <div class="body">
        <p>Hi <strong>${userName}</strong>,</p>
        
        <p>We noticed you requested to Confirm your Email. No worries.!</p>
        
        <p>Here’s your unique Confirmation code:</p>
        
        <div class="code-box">${tokenCode}</div>
        
        <p>Enter this code in the  Confirmation Page to continue. This code is valid for only <strong>15 minutes</strong>, so be sure to use it promptly.</p>
        
    
        
        <p>If you didn't request a Confirmation Token, you can safely ignore this email. Your account is still secure with us.</p>
        
        <p>Stay secure,</p>
        <p>The <strong>Mirror Xefro</strong> Team</p>
      </div>
      
      <div class="footer">
        <p>&copy; 2025 Mirror Xefro. All rights reserved.</p>
        <p>Need help? <a href="https://mir.xefro.net/support">Contact Support</a></p>
      </div>
    </div>
    </body>
    </html>
    
      
    `},


    async generateRandomNumberCode(length: number) {
      let code = "";

      for (let i = 0; i < length; i++) {
        const randomDigit = Math.floor(Math.random() * 10); // Generate a random digit (0-9)
        code += randomDigit.toString();
      }

      return code;
    },

    /**
     * Creates a generic OTP message template for WhatsApp
     * @param verificationCode - The OTP code to include in the message
     * @param purpose - Optional purpose of the OTP (e.g., "password reset", "email confirmation")
     * @returns Formatted WhatsApp message string
     */
    customWhatsAppOTPMessage(verificationCode: String, purpose?: String,userName?:String): String {
      const purposeText = purpose ? ` for ${purpose}` : '';
      return `🔐 *Xefro Verification Code*

Hello ${userName},

Your verification code${purposeText} is:

*${verificationCode}*

This code is valid for *15 minutes*. Please do not share this code with anyone.

If you didn't request this code, please ignore this message.

Stay secure,
*Xefro Taxi Team*`;
    },

    async validateForgotPasswordBody(body: any): Promise<{ email: String }> {
      const schema = yup.object().shape({
        email: yup.string().email().required(),
      });
      const res = await schema.validate(body, { abortEarly: false });
      return {
        email: res.email
      };
    }


  };

  function phoneNumAlterDomain() { return "@xefro.net" };

  async function generateRandomNumberCode(length: number) {
    let code = "";

    for (let i = 0; i < length; i++) {
      const randomDigit = Math.floor(Math.random() * 10); // Generate a random digit (0-9)
      code += randomDigit.toString();
    }

    return code;
  }
}
export default userUtils;
