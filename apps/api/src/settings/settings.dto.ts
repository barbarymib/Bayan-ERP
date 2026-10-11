import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SetSettingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  value!: string;
}
