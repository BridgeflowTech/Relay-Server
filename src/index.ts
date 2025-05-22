import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = Fastify();
app.register(websocket);

// Health check route
app.get('/health', async (request, reply) => {
  reply.code(200);
  return { status: 'ok' };
});

// WebSocket endpoint (placeholder)
app.get('/ws', { websocket: true }, (connection /*, req */) => {
  connection.socket.on('message', (message: any) => {
    // Handle incoming messages (audio, commands, etc.)
    console.log('Received message:', message.toString());
    // Echo for now
    connection.socket.send('Echo: ' + message);
  });
});

const PORT = process.env.PORT || 3001;
app.listen({ port: Number(PORT), host: '0.0.0.0' }, err => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Relay server listening on http://localhost:${PORT}`);
}); 