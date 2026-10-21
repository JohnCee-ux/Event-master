import { Resend } from 'resend';
import nodemailer, { type Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getResendClient = (): Resend | null => {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key || key.startsWith('your_') || key.startsWith('replace_')) {
    return null;
  }
  return new Resend(key);
};

const getFromEmail = (name: string = 'GateKeeper'): string => {
  if (process.env.RESEND_FROM_EMAIL) {
    return process.env.RESEND_FROM_EMAIL;
  }
  if (process.env.EMAIL_FROM) {
    return process.env.EMAIL_FROM;
  }
  return `"${name}" <onboarding@resend.dev>`;
};

// Fallback nodemailer transporter (for offline dev or before API key is provided)
const getFallbackTransporter = async (): Promise<Transporter> => {
  if (transporter) return transporter;

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASS;

  if (emailUser && emailPass) {
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });
    return transporter;
  }

  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`[Email Dev] Configured Ethereal Email test fallback: ${testAccount.user}`);
    return transporter;
  } catch (err) {
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'windows',
      buffer: true,
    });
    return transporter;
  }
};

export interface SendTicketEmailParams {
  toEmail: string;
  attendeeName: string;
  eventName: string;
  venue: string;
  date: string;
  startTime: string;
  ticketType: string;
  ticketCode: string;
  qrDataUrl: string;
}

export const sendTicketEmail = async (
  params: SendTicketEmailParams
): Promise<{ success: boolean; previewUrl?: string; error?: string }> => {
  try {
    const safe = {
      eventName: escapeHtml(params.eventName),
      ticketType: escapeHtml(params.ticketType),
      ticketCode: escapeHtml(params.ticketCode),
      attendeeName: escapeHtml(params.attendeeName),
      date: escapeHtml(params.date),
      startTime: escapeHtml(params.startTime),
      venue: escapeHtml(params.venue),
    };

    const qrMatch = params.qrDataUrl.match(/^data:image\/\w+;base64,(.+)$/s);
    const base64Data = qrMatch ? qrMatch[1] : params.qrDataUrl;
    const qrBuffer = Buffer.from(base64Data, 'base64');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0A0F1C; color: #F3F4F6; margin: 0; padding: 24px; }
          .card { max-width: 520px; margin: 0 auto; background-color: #111827; border: 1px solid #1F2937; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
          .header { background: linear-gradient(135deg, #1E40AF 0%, #3B82F6 50%, #EC4899 100%); padding: 32px 24px; text-align: center; }
          .header h1 { margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
          .header p { margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.85); font-size: 14px; }
          .content { padding: 28px 24px; text-align: center; }
          .ticket-badge { display: inline-block; background-color: rgba(59, 130, 246, 0.15); border: 1px solid #3B82F6; color: #60A5FA; padding: 4px 14px; border-radius: 9999px; font-size: 13px; font-weight: 600; text-transform: uppercase; margin-bottom: 20px; }
          .qr-box { background-color: #FFFFFF; padding: 16px; border-radius: 12px; display: inline-block; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
          .code-box { background-color: #0A0F1C; border: 1px dashed #374151; border-radius: 8px; padding: 12px; margin-bottom: 24px; }
          .code-label { font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
          .code-val { font-family: monospace; font-size: 20px; font-weight: 700; color: #38BDF8; letter-spacing: 2px; }
          .details-table { width: 100%; text-align: left; background-color: #0A0F1C; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-collapse: collapse; }
          .details-table td { padding: 6px 8px; font-size: 14px; }
          .detail-label { color: #9CA3AF; width: 35%; }
          .detail-value { color: #F3F4F6; font-weight: 500; }
          .footer { text-align: center; color: #6B7280; font-size: 12px; border-top: 1px solid #1F2937; padding-top: 16px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>${safe.eventName}</h1>
            <p>Official Event Entry Ticket</p>
          </div>
          <div class="content">
            <div class="ticket-badge">${safe.ticketType} Pass</div>
            
            <div style="margin-bottom: 16px;">
              <div class="qr-box">
                <img src="${params.qrDataUrl}" alt="QR Ticket" width="200" height="200" style="display: block; border-radius: 6px;" />
              </div>
              <p style="font-size: 12px; color: #9CA3AF; margin: 4px 0 0 0;">
                (Your entry QR code is also attached as <strong>ticket-qr.png</strong>)
              </p>
            </div>

            <div class="code-box">
              <div class="code-label">Ticket Code (Manual Entry)</div>
              <div class="code-val">${safe.ticketCode}</div>
            </div>

            <table class="details-table">
              <tr>
                <td class="detail-label">Attendee</td>
                <td class="detail-value">${safe.attendeeName}</td>
              </tr>
              <tr>
                <td class="detail-label">Date</td>
                <td class="detail-value">${safe.date}</td>
              </tr>
              <tr>
                <td class="detail-label">Time</td>
                <td class="detail-value">${safe.startTime}</td>
              </tr>
              <tr>
                <td class="detail-label">Venue</td>
                <td class="detail-value">${safe.venue}</td>
              </tr>
            </table>

            <p style="font-size: 13px; color: #9CA3AF; margin: 0;">
              Please present this QR code or ticket code at the entrance for fast check-in.
            </p>

            <div class="footer">
              Powered by GateKeeper Secure Check-In System
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const resend = getResendClient();

    if (resend) {
      const { data, error } = await resend.emails.send({
        from: getFromEmail('GateKeeper Events'),
        to: [params.toEmail],
        subject: `Your Ticket for ${params.eventName} (${params.ticketCode})`,
        html: htmlContent,
        attachments: [
          {
            filename: `ticket-${params.ticketCode}.png`,
            content: qrBuffer,
          },
        ],
      });

      if (error) {
        console.error(`[Resend Ticket Error] to ${params.toEmail}:`, error.message);
        return { success: false, error: error.message };
      }

      console.log(`[Resend Ticket Sent] Message ID: ${data?.id} to ${params.toEmail}`);
      return { success: true };
    }

    // Nodemailer / Ethereal fallback when RESEND_API_KEY is not yet supplied
    console.warn(`[Email Notice] RESEND_API_KEY not configured. Sending ticket to ${params.toEmail} via fallback...`);
    const transport = await getFallbackTransporter();
    const info = await transport.sendMail({
      from: getFromEmail('GateKeeper Events'),
      to: params.toEmail,
      subject: `Your Ticket for ${params.eventName} (${params.ticketCode})`,
      html: htmlContent,
      attachments: [
        {
          filename: 'ticket-qr.png',
          content: qrBuffer,
          cid: 'ticket-qr',
        },
      ],
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    if (previewUrl) {
      console.log(`[Fallback Email] Ticket preview: ${previewUrl}`);
    }
    return { success: true, previewUrl };
  } catch (err: any) {
    console.error(`[Email Error] Failed to send ticket email to ${params.toEmail}:`, err?.message || err);
    return { success: false, error: err?.message || 'Email delivery failed' };
  }
};

export const sendOtpEmail = async (
  toEmail: string,
  otp: string,
  purpose: 'login' | 'password-reset' = 'login'
): Promise<{ success: boolean; previewUrl?: string; error?: string }> => {
  try {
    const isPasswordReset = purpose === 'password-reset';
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #070B14; color: #F1F5F9; margin: 0; padding: 32px 16px; }
          .card { max-width: 480px; margin: 0 auto; background-color: #0D1224; border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); }
          .header { background: radial-gradient(circle at center, #1D4ED8 0%, #0A1026 100%); padding: 36px 24px 28px; text-align: center; border-bottom: 1px solid rgba(59, 130, 246, 0.2); }
          .logo-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); padding: 6px 16px; border-radius: 9999px; font-size: 13px; font-weight: 700; color: #60A5FA; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
          .header h1 { margin: 0; color: #FFFFFF; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
          .header p { margin: 8px 0 0 0; color: #94A3B8; font-size: 14px; }
          .content { padding: 32px 28px; text-align: center; }
          .otp-container { background: #070B14; border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 14px; padding: 20px; margin: 24px 0; box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.6); }
          .otp-label { font-size: 12px; text-transform: uppercase; color: #94A3B8; letter-spacing: 1.5px; margin-bottom: 8px; font-weight: 600; }
          .otp-code { font-family: 'Courier New', monospace; font-size: 38px; font-weight: 800; color: #38BDF8; letter-spacing: 8px; text-shadow: 0 0 16px rgba(56, 189, 248, 0.5); }
          .note { font-size: 13px; color: #94A3B8; line-height: 1.6; margin: 0 0 16px; }
          .security-pill { display: inline-block; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #FBBF24; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 500; }
          .footer { text-align: center; color: #64748B; font-size: 12px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 20px; margin-top: 28px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo-badge">⚡ GateKeeper Auth</div>
            <h1>${isPasswordReset ? 'Password Reset Code' : 'Email Authentication Code'}</h1>
            <p>${isPasswordReset ? 'Use this one-time code to reset your GateKeeper password' : 'Your one-time passcode for secure passwordless sign-in'}</p>
          </div>
          <div class="content">
            <p class="note">${isPasswordReset ? 'Enter this 6-digit code to choose a new password:' : 'Enter this 6-digit verification code to access your command center:'}</p>
            
            <div class="otp-container">
              <div class="otp-label">One-Time Passcode (OTP)</div>
              <div class="otp-code">${otp}</div>
            </div>

            <div class="security-pill">
              ⏱ Valid for 10 minutes • Do not share this code with anyone
            </div>

            <div class="footer">
              If you didn't request this code, you can safely ignore this email.<br/>
              Protected by GateKeeper Secure Auth.
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const resend = getResendClient();

    if (resend) {
      const { data, error } = await resend.emails.send({
        from: getFromEmail('GateKeeper Auth'),
        to: [toEmail],
        subject: isPasswordReset ? `Your Password Reset Code - GateKeeper` : `Your Login Code: ${otp} - GateKeeper Authentication`,
        html: htmlContent,
      });

      if (error) {
        console.error(`[Resend OTP Error] to ${toEmail}:`, error.message);
        return { success: false, error: error.message };
      }

      console.log(`[Resend OTP Sent] Message ID: ${data?.id} to ${toEmail}`);
      return { success: true };
    }

    // Fallback if no key configured
    console.warn(`[Email Notice] RESEND_API_KEY not configured. Sending OTP to ${toEmail} via fallback...`);
    const transport = await getFallbackTransporter();
    const info = await transport.sendMail({
      from: getFromEmail('GateKeeper Auth'),
      to: toEmail,
      subject: isPasswordReset ? `Your Password Reset Code - GateKeeper` : `Your Login Code: ${otp} - GateKeeper Authentication`,
      html: htmlContent,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    if (previewUrl) {
      console.log(`[Fallback OTP] Preview: ${previewUrl}`);
    }
    return { success: true, previewUrl };
  } catch (err: any) {
    console.error(`[Email OTP Error] Failed to send OTP to ${toEmail}:`, err?.message || err);
    return { success: false, error: err?.message || 'Email delivery failed' };
  }
};
