export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  frontendOrigins: string[];
  frontendUrl: string;
  googleClientId: string;
  googleClientSecret: string;
  googleCallbackUrl: string;
  googleAuthMode: 'mock' | 'google';
  secureCookies: boolean;
  sessionSecret: string;
  resendApiKey: string;
  emailFrom: string;
}
