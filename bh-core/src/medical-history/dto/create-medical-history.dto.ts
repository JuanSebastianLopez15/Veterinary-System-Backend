import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsInt, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

class MedicamentoDto {
  @IsOptional()
  @IsString()
  productoCodigo?: string;

  @IsString()
  dosis: string;

  @IsString()
  duracion: string;

  @IsInt()
  @Min(1)
  cantidad: number;
}

class VacunaDto {
  @IsString()
  nombre: string;

  @IsDateString()
  fecha: string;

  @IsOptional()
  @IsDateString()
  fechaSiguienteVacuna?: string;
}

export class CreateMedicalHistoryDto {
  @IsString()
  motivo_visita: string;

  @IsString()
  diagnostico: string;

  @IsString()
  tratamiento_aplicado: string;

  @IsNumber()
  peso_mascota: number;

  @IsOptional()
  @IsDateString()
  proxima_visita?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicamentoDto)
  medicamentos?: MedicamentoDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VacunaDto)
  vacunas?: VacunaDto[];
}