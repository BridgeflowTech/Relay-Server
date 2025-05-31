export interface Integration {
  initiateCall(args: any): Promise<any>;
  // Add more methods as needed for your use case
} 