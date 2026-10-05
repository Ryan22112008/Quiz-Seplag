export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  frontendOrigins: string[];
  googleClientId: string;
  googleClientSecret: string;
  googleCallbackUrl: string;
  sessionSecret: string;
  frontendUrl: string;
}
