import { IsDateString, IsNotEmpty } from 'class-validator';

export class DateRangeDto {
  @IsNotEmpty()
  @IsDateString()
  fechaInicio: string;

  @IsNotEmpty()
  @IsDateString()
  fechaFin: string;
}