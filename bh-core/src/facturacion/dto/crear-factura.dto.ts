import { IsNotEmpty, IsUUID, IsOptional, IsNumber, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DetalleMedicamentoDto {
  @IsNotEmpty()
  @IsUUID()
  productoId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  cantidad: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  precioUnitario: number;
}

export class CrearFacturaDto {
  @IsNotEmpty()
  @IsUUID()
  citaId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({each: true })
  @Type(() => DetalleMedicamentoDto)
  medicamentosAdicionales?: DetalleMedicamentoDto[];
}