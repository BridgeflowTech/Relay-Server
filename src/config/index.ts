import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  host: process.env.HOST || '0.0.0.0',
  elevenlabs: {
    agentId: process.env.ELEVENLABS_AGENT_ID,
    apiKey: process.env.ELEVENLABS_API_KEY,
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },
  convex: {
    token: process.env.CONVEX_API_KEY,
    url: process.env.CONVEX_URL,
  }
};