import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AuditAction } from '../audit/enums/audit-action.enum';

describe('InventoryService', () => {
  let prisma: any;
  let auditService: any;
  let service: InventoryService;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inOneWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const inOneYear = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);

  const productRow = {
    codigo: 'prod-1',
    nombre: 'Amoxicilina',
    tipo: 'medicamento',
    stock: 10,
    stock_minimo: 5,
    precio: 2500,
    fecha_vencimiento: inOneYear,
    creado_en: new Date(),
  };

  beforeEach(() => {
    prisma = {
      producto: {
        create: jest.fn().mockResolvedValue(productRow),
        findMany: jest.fn().mockResolvedValue([productRow]),
        findUnique: jest.fn().mockResolvedValue(productRow),
        update: jest.fn().mockResolvedValue(productRow),
      },
      movimiento_inventario: {
        create: jest.fn().mockReturnValue({ __movement: true }),
      },
      $transaction: jest.fn().mockImplementation(async (ops: any[]) => ops),
      $queryRaw: jest.fn().mockResolvedValue([productRow]),
    };
    // Override $transaction to actually execute updates and return their results
    prisma.$transaction = jest.fn(async (ops: any[]) => {
      // For these tests we don't need real chaining: just return the rows.
      return [productRow, { __movement: true }];
    });

    auditService = {
      emit: jest.fn().mockResolvedValue(undefined),
    };

    service = new InventoryService(prisma, auditService);
  });

  it('Test 1: createProduct succeeds with valid data', async () => {
    const result = await service.createProduct({
      name: 'Amoxicilina',
      type: 'medicamento',
      stock: 10,
      minStock: 5,
      price: 2500,
    });
    expect(prisma.producto.create).toHaveBeenCalled();
    expect(result.id).toBe('prod-1');
    expect(result.isLowStock).toBe(false);
  });

  it('Test 2: createProduct throws BadRequestException on negative stock', async () => {
    await expect(
      service.createProduct({
        name: 'X',
        type: 'medicamento',
        stock: -1,
        minStock: 0,
        price: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Test 3: createProduct throws BadRequestException on negative price', async () => {
    await expect(
      service.createProduct({
        name: 'X',
        type: 'medicamento',
        stock: 0,
        minStock: 0,
        price: -1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Test 4: getLowStock returns products with isLowStock=true when stock <= minStock', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { ...productRow, stock: 2, stock_minimo: 5 },
    ]);
    const result = await service.getLowStock();
    expect(result.data[0].isLowStock).toBe(true);
    expect(result.data[0].stock).toBeLessThanOrEqual(result.data[0].minStock);
  });

  it('Test 5: getExpiringSoon returns products with isExpiringSoon=true when within 30 days', async () => {
    prisma.producto.findMany.mockResolvedValue([
      { ...productRow, fecha_vencimiento: inOneWeek },
    ]);
    const result = await service.getExpiringSoon();
    expect(result.data[0].isExpiringSoon).toBe(true);
  });

  it('Test 6: findAll returns every product with isLowStock and isExpiringSoon flags present', async () => {
    prisma.producto.findMany.mockResolvedValue([
      productRow,
      { ...productRow, codigo: 'prod-2', stock: 1, stock_minimo: 5 },
    ]);
    const result = await service.findAll();
    expect(result.data).toHaveLength(2);
    for (const p of result.data) {
      expect(p).toHaveProperty('isLowStock');
      expect(p).toHaveProperty('isExpiringSoon');
      expect(typeof p.isLowStock).toBe('boolean');
      expect(typeof p.isExpiringSoon).toBe('boolean');
    }
  });

  it('Test 7: adjustStock calls $transaction and updates stock correctly', async () => {
    await service.adjustStock('prod-1', 5, 'reposición');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.producto.update).toHaveBeenCalledWith({
      where: { codigo: 'prod-1' },
      data: { stock: 15 },
    });
  });

  it('Test 8: adjustStock throws BadRequestException when result would be negative', async () => {
    await expect(service.adjustStock('prod-1', -50)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('Test 9: adjustStock emits audit event with action AJUSTE_MANUAL_STOCK', async () => {
    await service.adjustStock('prod-1', 2, 'reposición', 'admin-1', 'ADMIN');
    expect(auditService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.AJUSTE_MANUAL_STOCK }),
    );
  });

  it('Test 10: adjustStock completes successfully even when auditService.emit rejects', async () => {
    auditService.emit.mockRejectedValueOnce(new Error('audit down'));
    await expect(service.adjustStock('prod-1', 1)).resolves.toBeDefined();
  });

  it('Test 11: deductForPrescription returns { deducted: true } when stock is sufficient', async () => {
    prisma.producto.findMany.mockResolvedValue([productRow]);
    const result = await service.deductForPrescription('Amoxicilina', 3);
    expect(result.deducted).toBe(true);
    expect(result.productId).toBe('prod-1');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('Test 12: deductForPrescription throws BadRequestException when stock is insufficient', async () => {
    prisma.producto.findMany.mockResolvedValue([{ ...productRow, stock: 1 }]);
    await expect(
      service.deductForPrescription('Amoxicilina', 5),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Test 13: deductForPrescription returns { deducted: false } when product not found', async () => {
    prisma.producto.findMany.mockResolvedValue([]);
    const result = await service.deductForPrescription('Inexistente', 1);
    expect(result.deducted).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('Test 14: deductForPrescription $transaction array contains stock update and movement creation', async () => {
    prisma.producto.findMany.mockResolvedValue([productRow]);
    let receivedOps: any[] = [];
    prisma.$transaction = jest.fn(async (ops: any[]) => {
      receivedOps = ops;
      return ops;
    });
    await service.deductForPrescription('Amoxicilina', 2);
    expect(receivedOps).toHaveLength(2);
    expect(prisma.producto.update).toHaveBeenCalledWith({
      where: { codigo: 'prod-1' },
      data: { stock: 8 },
    });
    expect(prisma.movimiento_inventario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          producto_codigo: 'prod-1',
          tipo: 'DEDUCCION_PRESCRIPCION',
          cantidad: -2,
        }),
      }),
    );
  });

  it('Test 15: deductForPrescription completes successfully even when auditService.emit rejects', async () => {
    prisma.producto.findMany.mockResolvedValue([productRow]);
    auditService.emit.mockRejectedValueOnce(new Error('audit down'));
    await expect(
      service.deductForPrescription('Amoxicilina', 1),
    ).resolves.toEqual({ deducted: true, productId: 'prod-1' });
  });

  it('findOne throws NotFoundException when product is missing', async () => {
    prisma.producto.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
