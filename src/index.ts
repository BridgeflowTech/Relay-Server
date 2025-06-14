import Fastify, { FastifyInstance } from 'fastify';

import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import { Twilio } from 'twilio';
import { config } from './config';
import  WebSocket  from 'ws';
import { integrations } from "./integrations";
import { convexQuery } from "./convex";


// Load environment variables
dotenv.config();

const app:FastifyInstance = Fastify();
//app.register(websocket);
app.register(fastifyFormBody);
app.register(fastifyWs);


const PORT = process.env.PORT || 3001;

const twilioClient = new Twilio(config.twilio.accountSid, config.twilio.authToken);




app.post('/try-convex', async (request, reply) => {
  const data = request.body as {nodeId:string};
  
  const configurations = await convexQuery("flows/node/data:getNodeConfigurations", { nodeId: data.nodeId });
  console.log(configurations);
  reply.send(configurations);
});


app.post('/outbound-call', async (request, reply) => {
    const { number, prompt, first_message, nodeId, signedUrl } = request.body as { 
      number: string;
      prompt?: string;
      first_message?: string;
      nodeId?: string;
      signedUrl?: string;
      
    };
    
    

    if (!number) {
      return reply.code(400).send({ error: 'Phone number is required' });
    }

    
  
    try {
      const call = await twilioClient.calls.create({
        from: config.twilio.phoneNumber!,
        to: number,
        url: `https://${request.headers.host}/outbound-call-twiml?prompt=${encodeURIComponent(
          prompt || ''
        )}&first_message=${encodeURIComponent(first_message || '')}&nodeId=${nodeId}&signedUrl=${signedUrl}`,
      });
  
      reply.send({
        success: true,
        message: 'Call initiated',
        callSid: call.sid,
      });
    } catch (error) {
      console.error('Error initiating outbound call:', error);
      reply.code(500).send({
        success: false,
        error: 'Failed to initiate call',
      });
    }
  });

app.all('/outbound-call-twiml', async (request, reply) => {
    const prompt = (request.query as any).prompt || '';
    const first_message = (request.query as any).first_message || '';
    const nodeId = (request.query as any).nodeId || '';
    const signedUrl = (request.query as any).signedUrl || '';
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
          <Connect>
          <Stream url="wss://${request.headers.host}/outbound-media-stream">
              <Parameter name="prompt" value="${prompt}" />
              <Parameter name="first_message" value="${first_message}" />
              <Parameter name="nodeId" value="${nodeId}" />
              <Parameter name="signedUrl" value="${signedUrl}" />
          </Stream>
          </Connect>
      </Response>`;
  
    reply.type('text/xml').send(twimlResponse);
  });


app.register(async (fastifyInstance) => {
    fastifyInstance.get('/outbound-media-stream', { websocket: true }, (connection, req) => {
      const ws = connection;
      console.info('[Server] Twilio connected to outbound media stream');
      
      // Variables to track the call
      let streamSid: string | null = null;
      let callSid: string | null = null;
      let elevenLabsWs: WebSocket | null = null;
      let customParameters: any = null;
      let signedUrl: string | null = null;
  
      // Handle WebSocket errors
      ws.on('error', console.error);
  
      // Set up ElevenLabs connection
      const setupElevenLabs = async () => {
        try {
          const signedUrl = customParameters?.signedUrl;
         
          console.log(signedUrl);
          elevenLabsWs = new WebSocket(signedUrl);
          
          elevenLabsWs.on('open', () => {
            console.log('[ElevenLabs] Connected to Conversational AI');
  
            // Send initial configuration with prompt and first message
            const initialConfig = {
              type: 'conversation_initiation_client_data',
              dynamic_variables: {
                user_name: 'Angelo',
                user_id: 1234,
              },
              conversation_config_override: {
                agent: {
                  prompt: {
                    prompt: customParameters?.prompt || 'you are a gary from the phone store',
                  },
                  first_message:
                    customParameters?.first_message || 'hey there! how can I help you today?',
                },
              },
            };
  
            console.log(
              '[ElevenLabs] Sending initial config with prompt:',
              initialConfig.conversation_config_override.agent.prompt.prompt
            );
  
            // Send the configuration to ElevenLabs
            if (elevenLabsWs) {
              elevenLabsWs.send(JSON.stringify(initialConfig));
            }
          });
  
          elevenLabsWs.on('message', (data) => {
            try {
              const message = JSON.parse(data.toString());
  
              switch (message.type) {
                case 'conversation_initiation_metadata':
                  console.log('[ElevenLabs] Received initiation metadata');
                  break;
  
                case 'audio':
                  if (streamSid) {
                    if (message.audio?.chunk) {
                      const audioData = {
                        event: 'media',
                        streamSid,
                        media: {
                          payload: message.audio.chunk,
                        },
                      };
                      ws.send(JSON.stringify(audioData));
                    } else if (message.audio_event?.audio_base_64) {
                      const audioData = {
                        event: 'media',
                        streamSid,
                        media: {
                          payload: message.audio_event.audio_base_64,
                        },
                      };
                      ws.send(JSON.stringify(audioData));
                    }
                  } else {
                    console.log('[ElevenLabs] Received audio but no StreamSid yet');
                  }
                  break;
  
                case 'interruption':
                  if (streamSid) {
                    ws.send(
                      JSON.stringify({
                        event: 'clear',
                        streamSid,
                      })
                    );
                  }
                  break;
  
                case 'ping':
                  if (message.ping_event?.event_id) {
                    elevenLabsWs?.send(
                      JSON.stringify({
                        type: 'pong',
                        event_id: message.ping_event.event_id,
                      })
                    );
                  }
                  break;
  
                case 'agent_response':
                  console.log(
                    `[Twilio] Agent response: ${message.agent_response_event?.agent_response}`
                  );
                  break;
  
                case 'user_transcript':
                  console.log(
                    `[Twilio] User transcript: ${message.user_transcription_event?.user_transcript}`
                  );
                  break;
  
                default:
                  console.log(`[ElevenLabs] Unhandled message type: ${message.type}`);
              }
            } catch (error) {
              console.error('[ElevenLabs] Error processing message:', error);
            }
          });
  
          elevenLabsWs.on('error', (error) => {
            console.error('[ElevenLabs] WebSocket error:', error);
          });
  
          elevenLabsWs.on('close', () => {
            console.log('[ElevenLabs] Disconnected');
          });
        } catch (error) {
          console.error('[ElevenLabs] Setup error:', error);
        }
      };
  
      // Set up ElevenLabs connection
      
  
      // Handle messages from Twilio
      ws.on('message', (message) => {
        try {
          const msg = JSON.parse(message.toString());
          if (msg.event !== 'media') {
            console.log(`[Twilio] Received event: ${msg.event}`);
          }
  
          switch (msg.event) {
            case 'start':
              streamSid = msg.start.streamSid;
              callSid = msg.start.callSid;
              customParameters = msg.start.customParameters;              
              console.log(`[Twilio] Stream started - StreamSid: ${streamSid}, CallSid: ${callSid}`);
              console.log('[Twilio] Start parameters:', customParameters);
              setupElevenLabs();
              break;
  
            case 'media':
              if (elevenLabsWs?.readyState === WebSocket.OPEN) {
                const audioMessage = {
                  user_audio_chunk: Buffer.from(msg.media.payload, 'base64').toString('base64'),
                };
                elevenLabsWs.send(JSON.stringify(audioMessage));
              }
              break;
  
            case 'stop':
              console.log(`[Twilio] Stream ${streamSid} ended`);
              if (elevenLabsWs?.readyState === WebSocket.OPEN) {
                elevenLabsWs.close();
              }
              break;
  
            default:
              console.log(`[Twilio] Unhandled event: ${msg.event}`);
          }
        } catch (error) {
          console.error('[Twilio] Error processing message:', error);
        }
      });
  
      // Handle WebSocket closure
      ws.on('close', () => {
        console.log('[Twilio] Client disconnected');
        if (elevenLabsWs?.readyState === WebSocket.OPEN) {
          elevenLabsWs.close();
        }
      });
    });
  });





// Health check route
app.get('/health', async (request, reply) => {
  reply.code(200);
  return { status: 'ok' };
});

// WebSocket endpoint (placeholder)
// app.get('/ws', { websocket: true }, (connection /*, req */) => {
//   connection.socket.on('message', (message: any) => {
//     // Handle incoming messages (audio, commands, etc.)
//     console.log('Received message:', message.toString());
//     // Echo for now
//     connection.socket.send('Echo: ' + message);
//   });
// });

// Global error handler
app.setErrorHandler((error, request, reply) => {
  console.error('[Error Handler]', {
    error: error.message,
    stack: error.stack,
    path: request.url,
    method: request.method,
    params: request.params,
    query: request.query,
    body: request.body,
  });

  reply.status(500).send({
    error: 'Internal Server Error',
    message: error.message,
  });
});

app.post('/integrate', async (request, reply) => {
  const { source, provider, ...rest } = request.body as { source: string; provider: string; [key: string]: any };
  if (!source || !provider) {
    return reply.code(400).send({ error: 'Missing source or provider' });
  }
  // Fetch config from Convex for this source/provider node
  const config = await convexQuery("flows/node/data:getNodeConfigurations", { nodeId: source });
  // Route to the correct integration
  const integration = integrations[provider];
  if (!integration) {
    return reply.code(400).send({ error: "Unknown provider" });
  }
  const result = await integration.initiateCall({ ...rest, config });
  reply.send(result);
});

app.listen({ port: Number(PORT), host: '0.0.0.0' }, err => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Relay server listening on http://localhost:${PORT}`);
}); 