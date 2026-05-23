import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AnularFacturaDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(10, { message: 'El motivo de anulación debe tener al menos 10 caracteres' })
  motivoAnulacion: string;
}