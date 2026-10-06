export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  frontendOrigins: string[];
  sessionSecret: string;
  frontendUrl: string;
  resendApiKey?: string;
  emailFrom?: string;
  exposeVerificationUrl: boolean;
}
