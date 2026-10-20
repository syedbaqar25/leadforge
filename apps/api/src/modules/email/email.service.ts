import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    const host = process.env.SMTP_HOST || 'localhost';
    const port = Number(process.env.SMTP_PORT) || 1025;
    const isDev = process.env.NODE_ENV !== 'production';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false, // true for 465, false for other ports
      ignoreTLS: isDev,
      ...(process.env.SMTP_USER
        ? {
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          }
        : {}),
    });
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    const from = process.env.SMTP_FROM || 'Leadforge <noreply@leadforge.dev>';
    try {
      if (process.env.NODE_ENV === 'test') {
        this.logger.debug(`[TEST MODE] Email to ${options.to}: ${options.subject}`);
        return true;
      }

      await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>?/gm, ''),
      });

      this.logger.log(`Email dispatched to ${options.to} [${options.subject}]`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${options.to}: ${error.message}`, error.stack);
      // Non-blocking in dev/test so auth flows don't crash if SMTP is not reachable
      return false;
    }
  }

  async sendVerificationEmail(to: string, token: string, orgName?: string): Promise<boolean> {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const verifyUrl = `${webUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;

    return this.sendEmail({
      to,
      subject: `Verify your email for Leadforge${orgName ? ` (${orgName})` : ''}`,
      html: `
        <div style="font-family: 'Source Sans 3', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1A1A1A; background-color: #FAF7F2; border-radius: 6px;">
          <h2 style="font-family: 'Playfair Display', serif; color: #1A1A1A; margin-bottom: 16px;">Welcome to Leadforge</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #7A7267;">
            Please verify your email address to activate your account and start managing your sales pipeline.
          </p>
          <div style="margin: 28px 0;">
            <a href="${verifyUrl}" style="background-color: #D64933; color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p style="font-size: 13px; color: #A09888;">
            If you did not create a Leadforge account, you can safely ignore this email. This link will expire in 24 hours.
          </p>
          <p style="font-size: 12px; color: #A09888; margin-top: 24px; border-top: 1px solid #E8E2D9; padding-top: 12px;">
            Link: <a href="${verifyUrl}" style="color: #3A6B8A;">${verifyUrl}</a>
          </p>
        </div>
      `,
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const resetUrl = `${webUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

    return this.sendEmail({
      to,
      subject: 'Reset your Leadforge password',
      html: `
        <div style="font-family: 'Source Sans 3', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1A1A1A; background-color: #FAF7F2; border-radius: 6px;">
          <h2 style="font-family: 'Playfair Display', serif; color: #1A1A1A; margin-bottom: 16px;">Password Reset Request</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #7A7267;">
            We received a request to reset your password. Click the button below to choose a new password:
          </p>
          <div style="margin: 28px 0;">
            <a href="${resetUrl}" style="background-color: #D64933; color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="font-size: 13px; color: #A09888;">
            If you did not request a password reset, no action is needed. This link expires in 1 hour.
          </p>
          <p style="font-size: 12px; color: #A09888; margin-top: 24px; border-top: 1px solid #E8E2D9; padding-top: 12px;">
            Link: <a href="${resetUrl}" style="color: #3A6B8A;">${resetUrl}</a>
          </p>
        </div>
      `,
    });
  }

  async sendInvitationEmail(
    to: string,
    orgName: string,
    token: string,
    inviterName: string,
    role: string,
  ): Promise<boolean> {
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const inviteUrl = `${webUrl}/auth/join?token=${encodeURIComponent(token)}`;

    return this.sendEmail({
      to,
      subject: `${inviterName} invited you to join ${orgName} on Leadforge`,
      html: `
        <div style="font-family: 'Source Sans 3', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1A1A1A; background-color: #FAF7F2; border-radius: 6px;">
          <h2 style="font-family: 'Playfair Display', serif; color: #1A1A1A; margin-bottom: 16px;">You've been invited</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #7A7267;">
            <strong>${inviterName}</strong> has invited you to join the <strong>${orgName}</strong> team on Leadforge as a <strong>${role}</strong>.
          </p>
          <div style="margin: 28px 0;">
            <a href="${inviteUrl}" style="background-color: #D64933; color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="font-size: 13px; color: #A09888;">
            This invitation will expire in 7 days. If you do not recognize this invitation, you can ignore this message.
          </p>
          <p style="font-size: 12px; color: #A09888; margin-top: 24px; border-top: 1px solid #E8E2D9; padding-top: 12px;">
            Link: <a href="${inviteUrl}" style="color: #3A6B8A;">${inviteUrl}</a>
          </p>
        </div>
      `,
    });
  }
}
