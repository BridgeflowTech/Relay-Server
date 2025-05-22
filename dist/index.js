"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
const app = (0, fastify_1.default)();
app.register(websocket_1.default);
// Health check route
app.get('/health', (request, reply) => __awaiter(void 0, void 0, void 0, function* () {
    return { status: 'ok' };
}));
// WebSocket endpoint (placeholder)
app.get('/ws', { websocket: true }, (connection /*, req */) => {
    connection.socket.on('message', (message) => {
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
    console.log(`Relay server listening on port ${PORT}`);
});
