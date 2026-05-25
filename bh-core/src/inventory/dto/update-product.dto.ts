import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ProductType } from './create-product.dto';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  expirationDate?: string;
}
