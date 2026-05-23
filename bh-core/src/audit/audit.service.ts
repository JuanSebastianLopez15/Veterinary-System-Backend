import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
//import { AuditAction } from '../audit/enums/audit-action.enum';

interface AuditEventPayload {
  action: string;
  userId: string | null;
  userRole: string | null;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly auditUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.auditUrl =
      this.configService.get<string>('AUDIT_URL') ??
      'http://localhost:3001/api/v1/audit/events';
  }

  async emit(payload: AuditEventPayload): Promise<void> {
    try {
      const response = await fetch(this.auditUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(
            `Audit rejected (${response.status}): ${text}`,
        );
      }
    } catch (err: any) {
      this.logger.warn(`Audit event failed: ${err.message}`);
    }
  }
}
