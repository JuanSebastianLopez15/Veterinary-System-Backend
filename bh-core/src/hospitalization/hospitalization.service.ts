import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Hospitalization } from './entities/hospitalization.entity';
import { EvolutionNote } from './entities/evolution-note.entity';
import { CreateHospitalizationDto } from './dto/create-hospitalization.dto';
import { DischargeHospitalizationDto } from './dto/discharge-hospitalization.dto';
import { CreateEvolutionNoteDto } from './dto/create-evolution-note.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class HospitalizationService {
  constructor(
    @InjectRepository(Hospitalization)
    private hospitalizationRepo: Repository<Hospitalization>,
    @InjectRepository(EvolutionNote)
    private evolutionNoteRepo: Repository<EvolutionNote>,
    private dataSource: DataSource,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateHospitalizationDto, veterinarianCode: string) {
    // 1. Verificar que la mascota existe con ese codigo
    const pet = await this.dataSource.query(
      `SELECT codigo, estado FROM "mascotas" WHERE codigo = $1`,
      [dto.mascotaCodigo]
    );
    if (!pet.length) throw new NotFoundException('Mascota no encontrada');
    
    // 2. Verificar que la mascota no está ya hospitalizada
    if (pet[0].estado === 'hospitalizada')
      throw new BadRequestException('La mascota ya se encuentra hospitalizada');
    
    // 3. Verificar que la mascota no está fallecida
    if (pet[0].estado === 'fallecida')
      throw new BadRequestException('No se puede internar una mascota fallecida');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const hospitalizationCodigo = `HOSP-${uuidv4()}`;

      const hospitalization = new Hospitalization();
      hospitalization.codigo = hospitalizationCodigo;
      hospitalization.mascotaCodigo = dto.mascotaCodigo;
      hospitalization.veterinarioCodigo = veterinarianCode;
      hospitalization.fechaIngreso = new Date(dto.fechaIngreso);
      hospitalization.motivo = dto.motivo;

      await queryRunner.manager.save(Hospitalization, hospitalization);

      // 5. Actualizar el campo estado en Mascotas a 'hospitalizada'
      await queryRunner.manager.query(
        `UPDATE "mascotas" SET estado = $1 WHERE codigo = $2`,
        ['hospitalizada', dto.mascotaCodigo]
      );

      await queryRunner.commitTransaction();

      // 6. Notificar a AuditService (fire-and-forget)
      this.auditService.log({
        accion: 'INICIO_HOSPITALIZACION',
        usuarioCodigo: veterinarianCode,
        rol: 'veterinario',
        detalle: `Mascota ${dto.mascotaCodigo} internada`,
      }).catch(() => {});

      return { mensaje: 'Mascota internada exitosamente', codigo: hospitalizationCodigo };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async discharge(hospitalizationId: string, dto: DischargeHospitalizationDto, veterinarianCode: string) {
    // 1. Verificar que la hospitalización existe
    const hospitalization = await this.hospitalizationRepo.findOne({ where: { codigo: hospitalizationId } });
    if (!hospitalization) throw new NotFoundException('Hospitalización no encontrada');

    // 2. Verificar que la hospitalización no tiene ya fecha_salida registrada
    if (hospitalization.fechaSalida !== null)
      throw new BadRequestException('Esta hospitalización ya fue cerrada');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 3. Actualizar Hospitalizacion con fecha_salida y estado_egreso recibidos
      hospitalization.fechaSalida = new Date(dto.fechaSalida);
      hospitalization.estadoEgreso = dto.estadoEgreso;

      await queryRunner.manager.save(Hospitalization, hospitalization);

      // 4. Actualizar el campo estado en Mascotas según el estado_egreso
      let newPetState: string;
      switch (dto.estadoEgreso) {
        case 'recuperada':
          newPetState = 'activa';
          break;
        case 'fallecida':
          newPetState = 'fallecida';
          break;
        case 'trasladada':
          newPetState = 'activa';
          break;
        default:
          throw new BadRequestException('Estado de egreso no válido');
      }

      await queryRunner.manager.query(
        `UPDATE "mascotas" SET estado = $1 WHERE codigo = $2`,
        [newPetState, hospitalization.mascotaCodigo]
      );

      await queryRunner.commitTransaction();

      // 5. Notificar a AuditService (fire-and-forget)
      this.auditService.log({
        accion: 'ALTA_HOSPITALIZACION',
        usuarioCodigo: veterinarianCode,
        rol: 'veterinario',
        detalle: `Alta de hospitalización ${hospitalizationId}, egreso: ${dto.estadoEgreso}`,
      }).catch(() => {});

      return { mensaje: 'Alta registrada exitosamente' };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createEvolutionNote(hospitalizationId: string, dto: CreateEvolutionNoteDto, veterinarianCode: string) {
    // 1. Verificar que la hospitalización existe
    const hospitalization = await this.hospitalizationRepo.findOne({ where: { codigo: hospitalizationId } });
    if (!hospitalization) throw new NotFoundException('Hospitalización no encontrada');

    // 2. Verificar que la hospitalización sigue abierta (fecha_salida === null)
    if (hospitalization.fechaSalida !== null)
      throw new BadRequestException('No se pueden agregar notas a una hospitalización cerrada');

    // 3. Verificar que no existe ya una nota para esa fecha en la misma hospitalización
    const existingNote = await this.evolutionNoteRepo.findOne({
      where: {
        hospitalizacionCodigo: hospitalizationId,
        fecha: new Date(dto.fecha)
      }
    });
    if (existingNote)
      throw new BadRequestException('Ya existe una nota de evolución para esta fecha');

    // 4. Crear el registro en Nota_Evolucion
    const noteCodigo = `NE-${uuidv4()}`;

    const note = this.evolutionNoteRepo.create({
      codigo: noteCodigo,
      hospitalizacionCodigo: hospitalizationId,
      veterinarioCodigo: veterinarianCode,
      fecha: new Date(dto.fecha),
      nota: dto.nota,
    });

    await this.evolutionNoteRepo.save(note);

    // Notificar a AuditService (fire-and-forget)
    this.auditService.log({
      accion: 'NOTA_EVOLUCION_REGISTRADA',
      usuarioCodigo: veterinarianCode,
      rol: 'veterinario',
      detalle: `Nota de evolución registrada para hospitalización ${hospitalizationId}`,
    }).catch(() => {});

    return { mensaje: 'Nota de evolución registrada exitosamente', codigo: noteCodigo };
  }

  async getActiveHospitalizations() {
    const rawResults = await this.hospitalizationRepo
      .createQueryBuilder('hosp')
      .select([
        'hosp.codigo AS h_codigo',
        'hosp.fecha_ingreso AS h_fecha_ingreso',
        'hosp.motivo AS h_motivo',
        'mascota.codigo AS m_codigo',
        'mascota.nombre AS m_nombre',
        'mascota.especie AS m_especie',
        'mascota.raza AS m_raza',
        'usuario.codigo AS u_codigo',
        'usuario.nombre AS u_nombre',
        'usuario.apellido AS u_apellido',
        'usuario.correo AS u_correo',
      ])
      .innerJoin('mascotas', 'mascota', 'hosp.mascota_codigo = mascota.codigo')
      .innerJoin('usuario', 'usuario', 'hosp.veterinario_codigo = usuario.codigo')
      .where('hosp.fecha_salida IS NULL')
      .orderBy('hosp.fecha_ingreso', 'ASC')
      .getRawMany();

    const hoy = new Date();

    const hospitalizaciones = rawResults.map((row) => {
      const ingreso = new Date(row.h_fecha_ingreso);
      const diasInternada = Math.floor(
        (hoy.getTime() - ingreso.getTime()) / (1000 * 60 * 60 * 24)
      );

      const formatIso = (date: Date | string) => {
        if (!date) return '';
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toISOString().split('T')[0];
      };

      return {
        hospitalizacion: {
          codigo: row.h_codigo,
          fechaIngreso: formatIso(row.h_fecha_ingreso),
          motivo: row.h_motivo,
          diasInternada,
        },
        mascota: {
          codigo: row.m_codigo,
          nombre: row.m_nombre,
          especie: row.m_especie,
          raza: row.m_raza,
        },
        veterinario: {
          codigo: row.u_codigo,
          nombre: `${row.u_nombre} ${row.u_apellido}`,
          email: row.u_correo,
        },
      };
    });

    return {
      total: hospitalizaciones.length,
      hospitalizaciones,
    };
  }

  async getEvolutionNotes(hospitalizationId: string) {
    // Verificar que la hospitalización existe
    const hospitalization = await this.hospitalizationRepo.findOne({ where: { codigo: hospitalizationId } });
    if (!hospitalization) throw new NotFoundException('Hospitalización no encontrada');

    const notes = await this.evolutionNoteRepo.find({
      where: { hospitalizacionCodigo: hospitalizationId },
      order: { fecha: 'ASC' }
    });

    return {
      hospitalizacionCodigo: hospitalizationId,
      notas: notes.map(note => ({
        codigo: note.codigo,
        fecha: note.fecha,
        nota: note.nota,
        veterinarioCodigo: note.veterinarioCodigo,
        creadoEn: note.creadoEn
      }))
    };
  }
}
