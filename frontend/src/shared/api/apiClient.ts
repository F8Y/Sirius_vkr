export interface HealthResponse {
  status: string;
  services: {
    postgres?: string;
    redis?: string;
  };
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch("/health");
  if (!response.ok) {
    throw new Error(`Не удалось получить статус системы: ${response.statusText}`);
  }
  return response.json() as Promise<HealthResponse>;
}
