import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { MedicalHistory } from './entities/medical-history.entity';
import { PrescribedMedication } from './entities/prescribed-medication.entity';
import { Vaccine } from './entities/vaccine.entity';
import { Pet } from './entities/pet.entity';
import { Appointment } from './entities/appointment.entity';
import { Hospitalization } from './entities/hospitalization.entity';
import { CreateMedicalHistoryDto } from './dto/create-medical-history.dto';
import { EditMedicalHistoryDto } from './dto/edit-medical-history.dto';
import { CreateVaccineDto } from './dto/create-vaccine.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class MedicalHistoryService {
  constructor(
    @InjectRepository(MedicalHistory)
    private historialRepo: Repository<MedicalHistory>,
    @InjectRepository(PrescribedMedication)
    private medicamentoRepo: Repository<PrescribedMedication>,
    @InjectRepository(Vaccine)
    private vacunaRepo: Repository<Vaccine>,
    @InjectRepository(Pet)
    private petRepo: Repository<Pet>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(Hospitalization)
    private hospitalizationRepo: Repository<Hospitalization>,
    private dataSource: DataSource,
    private auditService: AuditService,
  ) {}

  async create(citaCodigo: string, dto: CreateMedicalHistoryDto, veterinarianCode: string) {
    const cita = await this.dataSource.query(
      `SELECT * FROM "Cita" WHERE codigo = $1`,
      [citaCodigo]
    );
    if (!cita.length) throw new NotFoundException('Cita no encontrada');
    if (cita[0].usuario_codigo !== veterinarianCode)
      throw new ForbiddenException('No tienes permiso sobre esta cita');
    if (cita[0].estado === 'cancelada')
      throw new BadRequestException('No se puede registrar historial de una cita cancelada');

    const existe = await this.historialRepo.findOne({ where: { citaCodigo } });
    if (existe) throw new BadRequestException('Esta cita ya tiene historial registrado');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const historialCodigo = `HM-${uuidv4()}`;
      const editableUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const historial = this.historialRepo.create({
        codigo: historialCodigo,
        citaCodigo,
        mascotaCodigo: cita[0].mascota_codigo,
        veterinarioCodigo: veterinarianCode,
        motivoVisita: dto.motivo_visita,
        diagnostico: dto.diagnostico,
        tratamientoAplicado: dto.tratamiento_aplicado,
        pesoMascota: dto.peso_mascota,
        proximaVisita: dto.proxima_visita ? new Date(dto.proxima_visita) : null,
        editableHasta: editableUntil,
      });

      await queryRunner.manager.save(MedicalHistory, historial);

      if (dto.medicamentos?.length) {
        for (const med of dto.medicamentos) {
          await queryRunner.manager.save(PrescribedMedication, {
            codigo: `MP-${uuidv4()}`,
            historialCodigo,
            productoCodigo: med.productoCodigo ?? null,
            dosis: med.dosis,
            duracion: med.duracion,
            cantidad_medicamentos_prescritos: med.cantidad,
          });

          if (med.productoCodigo) {
            const producto = await queryRunner.manager.query(
              `SELECT stock FROM "Producto" WHERE codigo = $1`,
              [med.productoCodigo]
            );
            if (producto.length && producto[0].stock >= med.cantidad) {
              await queryRunner.manager.query(
                `UPDATE "Producto" SET stock = stock - $1 WHERE codigo = $2`,
                [med.cantidad, med.productoCodigo]
              );
            }
          }
        }
      }

      if (dto.vacunas?.length) {
        for (const vac of dto.vacunas) {
          await queryRunner.manager.save(Vaccine, {
            codigo: `VAC-${uuidv4()}`,
            historialCodigo,
            mascotaCodigo: cita[0].mascota_codigo,
            nombre: vac.nombre,
            fecha: new Date(vac.fecha),
            fecha_siguiente_vacuna: vac.fechaSiguienteVacuna
              ? new Date(vac.fechaSiguienteVacuna)
              : null,
          });
        }
      }

      await queryRunner.manager.query(
        `UPDATE "Mascotas" SET peso = $1 WHERE codigo = $2`,
        [dto.peso_mascota, cita[0].mascota_codigo]
      );

      await queryRunner.commitTransaction();

      this.auditService.log({
        accion: 'CREACION_HISTORIAL_MEDICO',
        usuarioCodigo: veterinarianCode,
        rol: 'veterinario',
        detalle: `Historial creado para cita ${citaCodigo}`,
      }).catch(() => {});

      return { mensaje: 'Historial médico registrado exitosamente', codigo: historialCodigo };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async edit(citaCodigo: string, dto: EditMedicalHistoryDto, veterinarianCode: string) {
    const historial = await this.historialRepo.findOne({ where: { citaCodigo } });
    if (!historial) throw new NotFoundException('Historial médico no encontrado');
    
    if (historial.veterinarioCodigo !== veterinarianCode)
      throw new ForbiddenException('No tienes permiso sobre este historial');
    
    if (new Date() > historial.editableHasta)
      throw new BadRequestException('El historial ya no es editable');
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      if (dto.motivo_visita !== undefined) {
        historial.motivoVisita = dto.motivo_visita;
      }
      if (dto.diagnostico !== undefined) {
        historial.diagnostico = dto.diagnostico;
      }
      if (dto.tratamiento_aplicado !== undefined) {
        historial.tratamientoAplicado = dto.tratamiento_aplicado;
      }
      if (dto.proxima_visita !== undefined) {
        historial.proximaVisita = dto.proxima_visita ? new Date(dto.proxima_visita) : null;
      }
      
      await queryRunner.manager.save(MedicalHistory, historial);
      
      await queryRunner.commitTransaction();
      
      this.auditService.log({
        accion: 'EDICION_HISTORIAL_MEDICO',
        usuarioCodigo: veterinarianCode,
        rol: 'veterinario',
        detalle: `Historial editado para cita ${citaCodigo}`,
      }).catch(() => {});
      
      return { mensaje: 'Historial médico editado exitosamente' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  
    async getUpcomingVaccines() {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const vaccines = await this.dataSource.query(
      `SELECT v.codigo, v.nombre, v."fecha_siguiente_vacuna", v."mascota_codigo", v."historial_codigo" 
       FROM "Vacuna" v 
       WHERE v."fecha_siguiente_vacuna" >= CURRENT_DATE 
         AND v."fecha_siguiente_vacuna" <= $1
         AND v."fecha_siguiente_vacuna" IS NOT NULL`,
      [thirtyDaysFromNow]
    );
    
    return vaccines;
  }

  async addVaccine(historialId: string, dto: CreateVaccineDto, veterinarioCodigo: string) {
    // 1. Verificar que el historial existe con ese codigo
    const historial = await this.historialRepo.findOne({ where: { codigo: historialId } });
    if (!historial) {
      throw new NotFoundException('Historial médico no encontrado');
    }
    
    // 2. Verificar que el historial pertenece al veterinario autenticado
    if (historial.veterinarioCodigo !== veterinarioCodigo) {
      throw new ForbiddenException('No tienes permiso sobre este historial');
    }
    
    // 3. Crear el registro en Vacuna
    const vaccineCodigo = `VAC-${uuidv4()}`;
    
    const vaccine = this.vacunaRepo.create({
      codigo: vaccineCodigo,
      historialCodigo: historialId,
      mascotaCodigo: historial.mascotaCodigo,
      nombre: dto.nombre,
      fecha: new Date(dto.fecha),
      fechaSiguienteVacuna: dto.fechaSiguienteVacuna ? new Date(dto.fechaSiguienteVacuna) : null,
    });
    
    await this.vacunaRepo.save(vaccine);
    
    // 4. Notificar a AuditService (fire-and-forget)
    this.auditService.log({
      accion: 'REGISTRO_VACUNA',
      usuarioCodigo: veterinarioCodigo,
      rol: 'veterinario',
      detalle: `Vacuna registrada en historial ${historialId}`,
    }).catch(() => {});
    
    return { mensaje: 'Vacuna registrada exitosamente', codigo: vaccineCodigo };
  }

  async getPetHistoryFromAppointment(citaId: string, veterinarianCode: string) {
    // 1. Verificar que la cita existe
    const appointment = await this.appointmentRepo.findOne({ where: { codigo: citaId } });
    if (!appointment) throw new NotFoundException('Cita no encontrada');

    // 2. Verificar que la cita pertenece al veterinario autenticado
    if (appointment.veterinarioCodigo !== veterinarianCode)
      throw new ForbiddenException('No tienes permiso sobre esta cita');

    // 3. Verificar que la cita no está cancelada
    if (appointment.estado === 'cancelada')
      throw new BadRequestException('No puedes consultar el historial desde una cita cancelada');

    return this.getPetHistory(appointment.mascotaCodigo);
  }

  async getPetHistory(mascotaId: string) {
    // 4. Verificar que la mascota existe
    const pet = await this.petRepo.findOne({ where: { codigo: mascotaId } });
    if (!pet) throw new NotFoundException('Mascota no encontrada');

    // 5. Obtener historiales médicos ordenados por creado_en DESC
    const historiales = await this.historialRepo.find({
      where: { mascotaCodigo: mascotaId },
      relations: { medicamentos: true, vacunas: true },
      order: { creadoEn: 'DESC' },
    });

    // 6. Obtener hospitalizaciones ordenadas por fecha_ingreso DESC
    const hospitalizaciones = await this.hospitalizationRepo.find({
      where: { mascotaCodigo: mascotaId },
      relations: { notasEvolucion: true },
      order: { fechaIngreso: 'DESC' },
    });

    // Ordenar notas de evolución por fecha ASC dentro de cada hospitalización
    hospitalizaciones.forEach((h) => {
      if (h.notasEvolucion) {
        h.notasEvolucion.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      }
    });

    return {
      mascota: {
        codigo: pet.codigo,
        nombre: pet.nombre,
        especie: pet.especie,
        raza: pet.raza,
        color: pet.color,
        fechaNacimiento: pet.fechaNacimiento,
        peso: pet.peso,
        estado: pet.estado,
      },
      historialMedico: historiales.map((h) => ({
        codigo: h.codigo,
        citaCodigo: h.citaCodigo,
        motivoVisita: h.motivoVisita,
        diagnostico: h.diagnostico,
        tratamientoAplicado: h.tratamientoAplicado,
        pesoMascota: h.pesoMascota,
        proximaVisita: h.proximaVisita,
        editableHasta: h.editableHasta,
        creadoEn: h.creadoEn,
        medicamentos: h.medicamentos.map((m) => ({
          codigo: m.codigo,
          productoCodigo: m.productoCodigo,
          dosis: m.dosis,
          duracion: m.duracion,
          cantidad: m.cantidad,
        })),
        vacunas: h.vacunas.map((v) => ({
          codigo: v.codigo,
          nombre: v.nombre,
          fecha: v.fecha,
          fechaSiguienteVacuna: v.fechaSiguienteVacuna,
        })),
      })),
      hospitalizaciones: hospitalizaciones.map((h) => ({
        codigo: h.codigo,
        fechaIngreso: h.fechaIngreso,
        fechaSalida: h.fechaSalida,
        estadoEgreso: h.estadoEgreso,
        motivo: h.motivo,
        notasEvolucion: h.notasEvolucion.map((n) => ({
          codigo: n.codigo,
          fecha: n.fecha,
          nota: n.nota,
          veterinarioCodigo: n.veterinarioCodigo,
        })),
      })),
    };
  }

  async getIndividualHistory(historialId: string) {
    const h = await this.historialRepo.findOne({
      where: { codigo: historialId },
      relations: { medicamentos: true, vacunas: true },
    });

    if (!h) throw new NotFoundException('Historial médico no encontrado');

    return {
      codigo: h.codigo,
      citaCodigo: h.citaCodigo,
      motivoVisita: h.motivoVisita,
      diagnostico: h.diagnostico,
      tratamientoAplicado: h.tratamientoAplicado,
      pesoMascota: h.pesoMascota,
      proximaVisita: h.proximaVisita,
      editableHasta: h.editableHasta,
      creadoEn: h.creadoEn,
      medicamentos: h.medicamentos.map((m) => ({
        codigo: m.codigo,
        productoCodigo: m.productoCodigo,
        dosis: m.dosis,
        duracion: m.duracion,
        cantidad: m.cantidad,
      })),
      vacunas: h.vacunas.map((v) => ({
        codigo: v.codigo,
        nombre: v.nombre,
        fecha: v.fecha,
        fechaSiguienteVacuna: v.fechaSiguienteVacuna,
      })),
    };
  }
}