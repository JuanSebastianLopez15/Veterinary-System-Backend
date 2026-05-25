import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
//import { AuditAction } from '../audit/enums/audit-action.enum';

interface AuditEventPayload {
  action: string;
  userId: string;
  userRole: string;
  entityType: string;
  entityId?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  timestamp?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly auditUrl: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.enabled =
      this.configService.get<string>('AUDIT_ENABLED', 'true').toLowerCase() !== 'false';
    this.auditUrl =
      this.configService.get<string>('AUDIT_URL') ??
      'http://localhost:3001/api/v1/audit/events';
  }

  async emit(payload: AuditEventPayload): Promise<void> {
    if (!this.enabled) return;

    try {
      const auditPayload = {
        ...payload,
        ipAddress: payload.ipAddress ?? 'unknown',
        timestamp: payload.timestamp ?? new Date().toISOString(),
      };

      const response = await fetch(this.auditUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditPayload),
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

  async log(data: { accion: string; usuarioCodigo: string; rol: string; detalle: string }): Promise<void> {
    this.emit({
      action: data.accion,
      userId: data.usuarioCodigo,
      userRole: data.rol,
      entityType: 'MEDICAL_HISTORY',
      details: { message: data.detalle },
    });
  }
}
