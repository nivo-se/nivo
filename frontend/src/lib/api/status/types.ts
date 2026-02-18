export interface ApiErrorLog {
  message: string;
  endpoint: string;
  status?: number;
  timestamp: string;
}

export interface BackendStatus {
  status: string;
  [key: string]: unknown;
}
