import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
      'http://bh-audit-service:3001/api/v1/audit/events';
  }

  emit(payload: AuditEventPayload): void {
    fetch(this.auditUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err: Error) => {
      this.logger.warn(`Audit event could not be sent: ${err.message}`);
    });
  }

  async log(data: { accion: string; usuarioCodigo: string | null; rol: string | null; detalle: string }): Promise<void> {
    this.emit({
      action: data.accion,
      userId: data.usuarioCodigo,
      userRole: data.rol,
      entityType: 'MEDICAL_HISTORY',
      entityId: null,
      details: { message: data.detalle },
    });
  }
}
