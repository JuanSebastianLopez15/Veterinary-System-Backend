import { IsString, IsDateString, IsIn } from 'class-validator';

export class DischargeHospitalizationDto {
  @IsDateString()
  fechaSalida: string;

  @IsIn(['recuperada', 'fallecida', 'trasladada'], { message: 'estadoEgreso debe ser uno de: recuperada, fallecida, trasladada' })
  estadoEgreso: string;
}