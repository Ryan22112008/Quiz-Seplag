export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  frontendOrigins: string[];
}
