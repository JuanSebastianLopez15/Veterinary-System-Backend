import { IsString, IsDateString } from 'class-validator';

export class CreateHospitalizationDto {
  @IsString()
  mascotaCodigo: string;

  @IsString()
  motivo: string;

  @IsDateString()
  fechaIngreso: string;
}