import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CredentialsDto {
  @ApiProperty({ example: 'lectora@example.com', maxLength: 254 })
  // Se valida ya normalizado: " Lectora@Example.com " es la misma cuenta.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'El correo no es válido.' })
  @MaxLength(254, { message: 'El correo es demasiado largo.' })
  email!: string;

  @ApiProperty({ example: 'una frase larga y fácil de recordar', minLength: 8, maxLength: 128 })
  @IsString({ message: 'La contraseña debe ser texto.' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(128, { message: 'La contraseña no puede superar 128 caracteres.' })
  password!: string;
}

export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'lectora@example.com' })
  email!: string;
}

export class MeDto extends UserDto {
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class AccessTokenDto {
  @ApiProperty({ description: 'JWT para la cabecera Authorization: Bearer. Guárdalo en memoria.' })
  accessToken!: string;

  @ApiProperty({ example: 900, description: 'Segundos hasta que vence.' })
  expiresIn!: number;
}

export class LoginResponseDto extends AccessTokenDto {
  @ApiProperty({ type: UserDto })
  user!: UserDto;
}
