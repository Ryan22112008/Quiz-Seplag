import { API_BASE_URL } from '@/config/environment';

export function imageSource(path?: string): string | undefined {
  return path ? `${API_BASE_URL}${path}` : undefined;
}
