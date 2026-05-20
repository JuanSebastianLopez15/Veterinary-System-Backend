import { IsString, IsDateString } from 'class-validator';

export class CreateEvolutionNoteDto {
  @IsDateString()
  fecha: string;

  @IsString()
  nota: string;
}