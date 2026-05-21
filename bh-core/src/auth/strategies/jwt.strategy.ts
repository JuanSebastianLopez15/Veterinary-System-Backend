import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * Estrategia JWT para validar tokens de acceso.
 * Extrae el token del header Authorization (Bearer) y valida su firma.
 * El payload decodificado queda disponible en request.user para los guards.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Valida el payload del token JWT y retorna el usuario autenticado.
   * Este objeto queda disponible en request.user en los controladores.
   *
   * @param payload - Contenido decodificado del token JWT
   * @returns Objeto con codigo, correo y rol del usuario autenticado
   */
  async validate(payload: any) {
    return {
      codigo: payload.sub,
      correo: payload.correo,
      rol: payload.rol,
    };
  }
}
