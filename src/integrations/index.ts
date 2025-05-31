import { TwilioIntegration } from "./Twilio";
import { ElevenLabsIntegration } from "./ElevenLabs";
import { Integration } from "./types";

export const integrations: { [key: string]: Integration } = {
  twilio: TwilioIntegration,
  elevenlabs: ElevenLabsIntegration,
  // Add more as needed
}; 