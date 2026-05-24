import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum ProductType {
  MEDICATION = 'medicamento',
  VACCINE = 'vacuna',
  SURGICAL_SUPPLY = 'insumo_quirurgico',
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ProductType)
  type: ProductType;

  @IsInt()
  @Min(0)
  stock: number;

  @IsInt()
  @Min(0)
  minStock: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  expirationDate?: string;
}
