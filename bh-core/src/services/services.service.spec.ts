import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CatalogService, ServicesService } from './services.service';
import { AuditAction } from '../audit/enums/audit-action.enum';

describe('CatalogService (ServicesService)', () => {
  let prisma: any;
  let auditService: any;
  let service: CatalogService;

  const activeRow = {
    codigo: 'svc-1',
    nombre: 'Consulta General',
    descripcion: 'Consulta veterinaria general',
    precio: 50000,
    estado: 'activo',
    creado_en: new Date(),
    actualizado_en: new Date(),
  };

  const inactiveRow = { ...activeRow, codigo: 'svc-2', estado: 'inactivo' };

  beforeEach(() => {
    prisma = {
      servicio: {
        create: jest.fn().mockResolvedValue(activeRow),
        findMany: jest.fn().mockResolvedValue([activeRow]),
        findUnique: jest.fn().mockResolvedValue(activeRow),
        update: jest.fn().mockResolvedValue(activeRow),
      },
    };
    auditService = {
      emit: jest.fn().mockResolvedValue(undefined),
    };
    service = new ServicesService(prisma, auditService) as CatalogService;
  });

  it('Test 16: createService succeeds with valid data', async () => {
    const result = await service.createService({
      name: 'Consulta General',
      description: 'desc',
      price: 50000,
    });
    expect(prisma.servicio.create).toHaveBeenCalled();
    expect(result.id).toBe('svc-1');
    expect(result.isActive).toBe(true);
  });

  it('Test 17: createService throws BadRequestException on negative price', async () => {
    await expect(
      service.createService({ name: 'X', price: -1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Test 18: updatePrice updates price and emits audit with previousPrice and newPrice', async () => {
    prisma.servicio.findUnique.mockResolvedValue({ ...activeRow, precio: 30000 });
    prisma.servicio.update.mockResolvedValue({ ...activeRow, precio: 75000 });

    const result = await service.updatePrice('svc-1', 75000, 'admin-1', 'ADMIN');

    expect(result.price).toBe(75000);
    expect(auditService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.ACTUALIZACION_PRECIO_SERVICIO,
        details: expect.objectContaining({
          previousPrice: 30000,
          newPrice: 75000,
        }),
      }),
    );
  });

  it('Test 19: deactivate sets isActive false and emits DEACTIVATE_SERVICIO', async () => {
    prisma.servicio.findUnique.mockResolvedValue(activeRow);
    prisma.servicio.update.mockResolvedValue({ ...activeRow, estado: 'inactivo' });

    const result = await service.deactivate('svc-1');
    expect(result.isActive).toBe(false);
    expect(auditService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.DESACTIVACION_SERVICIO }),
    );
  });

  it('Test 20: deactivate throws BadRequestException if service already inactive', async () => {
    prisma.servicio.findUnique.mockResolvedValue(inactiveRow);
    await expect(service.deactivate('svc-2')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('Test 21: findActive returns only services where isActive is true', async () => {
    prisma.servicio.findMany.mockResolvedValue([activeRow]);
    const result = await service.findActive();
    expect(prisma.servicio.findMany).toHaveBeenCalledWith({
      where: { estado: 'activo' },
      orderBy: { creado_en: 'desc' },
    });
    expect(result.every((s) => s.isActive)).toBe(true);
  });

  it('Test 22: findInactive returns only services where isActive is false', async () => {
    prisma.servicio.findMany.mockResolvedValue([inactiveRow]);
    const result = await service.findInactive();
    expect(prisma.servicio.findMany).toHaveBeenCalledWith({
      where: { estado: 'inactivo' },
      orderBy: { creado_en: 'desc' },
    });
    expect(result.every((s) => !s.isActive)).toBe(true);
  });

  it('Test 23: createService emits CREACION_SERVICIO audit event', async () => {
    await service.createService({ name: 'X', price: 100 });
    expect(auditService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.CREACION_SERVICIO }),
    );
  });

  it('Test 24: deactivate emits DESACTIVACION_SERVICIO audit event', async () => {
    prisma.servicio.findUnique.mockResolvedValue(activeRow);
    prisma.servicio.update.mockResolvedValue({ ...activeRow, estado: 'inactivo' });
    await service.deactivate('svc-1');
    expect(auditService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.DESACTIVACION_SERVICIO }),
    );
  });

  it('Test 25: deactivate completes successfully even when auditService.emit rejects', async () => {
    prisma.servicio.findUnique.mockResolvedValue(activeRow);
    prisma.servicio.update.mockResolvedValue({ ...activeRow, estado: 'inactivo' });
    auditService.emit.mockRejectedValueOnce(new Error('audit down'));
    await expect(service.deactivate('svc-1')).resolves.toBeDefined();
  });

  it('updatePrice does not alter historical records (architectural invariant): price change does not touch citas/facturas', async () => {
    // Historical invariant: updating a Service's price only writes to the
    // `servicio` row. cita_servicios (appointments) and factura (billing)
    // store their own precio_unitario at creation time, so a later price
    // update never mutates those rows. Verified at the Prisma layer: the
    // service implementation only calls prisma.servicio.update — no calls
    // are made to prisma.cita, prisma.cita_servicios or prisma.factura.
    prisma.servicio.findUnique.mockResolvedValue({ ...activeRow, precio: 100 });
    prisma.servicio.update.mockResolvedValue({ ...activeRow, precio: 200 });

    await service.updatePrice('svc-1', 200);

    expect(prisma.servicio.update).toHaveBeenCalledTimes(1);
    // No cita / factura mutators should exist on the prisma mock — adding
    // them here makes the invariant explicit: if updatePrice ever started
    // calling them, this test would have to be updated.
    expect((prisma as any).cita).toBeUndefined();
    expect((prisma as any).cita_servicios).toBeUndefined();
    expect((prisma as any).factura).toBeUndefined();
  });

  it('findOne throws NotFoundException when service is missing', async () => {
    prisma.servicio.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
