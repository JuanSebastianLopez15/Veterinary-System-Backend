import { IsString, IsDateString, IsNotEmpty } from 'class-validator';

export class CreateEvolutionNoteDto {
  @IsDateString()
  @IsNotEmpty()
  fecha: string;

  @IsString()
  @IsNotEmpty()
  nota: string;
}