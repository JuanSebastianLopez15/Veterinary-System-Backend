import { IsNumber, Min } from 'class-validator';

export class UpdateServicePriceDto {
  @IsNumber()
  @Min(0)
  price: number;
}
