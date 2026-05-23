import { IsString, IsOptional, IsDateString } from 'class-validator';

export class EditMedicalHistoryDto {
  @IsOptional()
  @IsString()
  motivo_visita?: string;

  @IsOptional()
  @IsString()
  diagnostico?: string;

  @IsOptional()
  @IsString()
  tratamiento_aplicado?: string;

  @IsOptional()
  @IsDateString()
  proxima_visita?: string;
}