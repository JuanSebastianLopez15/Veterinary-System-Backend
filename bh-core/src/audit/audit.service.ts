import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AuditEventPayload {
  eventType: string;
  payload: Record<string, unknown>;
}

const AUDIT_REQUEST_TIMEOUT_MS = 3000;

@Injectable()
export class AuditService {
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (
      this.configService.get<string>('AUDIT_SERVICE_URL') ??
      'http://localhost:3001/api/v1'
    ).replace(/\/$/, '');
  }

  async notifyEvent(payload: AuditEventPayload): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/audit-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(AUDIT_REQUEST_TIMEOUT_MS),
      });
    } catch {
      return;
    }
  }
}
