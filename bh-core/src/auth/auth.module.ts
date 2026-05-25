import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type ms from 'ms';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';

import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuditModule,
    MailModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn = (
          configService.get<string>('JWT_EXPIRES_IN') ?? '8h'
        ) as ms.StringValue;

        return {
          secret: configService.get<string>('JWT_SECRET', 'super_secret_key_123'),
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    JwtStrategy,
  ],

  exports: [
    AuthService,
    JwtModule,
    JwtStrategy,
  ],
})
export class AuthModule {}
