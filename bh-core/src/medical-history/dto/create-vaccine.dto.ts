import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateVaccineDto {
  @IsString()
  nombre: string;

  @IsDateString()
  fecha: string;

  @IsOptional()
  @IsDateString()
  fechaSiguienteVacuna?: string;
}