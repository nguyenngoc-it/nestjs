import { ForbiddenException, Injectable } from '@nestjs/common';
import { User, Note } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthDTO } from './dto';
import * as argon from 'argon2';
import { error } from 'console';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}
  async register(authDTO: AuthDTO) {
    const hashedPassword = await argon.hash(authDTO.password);

    try {
      const user = await this.prismaService.user.create({
        data: {
          email: authDTO.email,
          hashedPassword: hashedPassword,
          firstName: '',
          lastName: '',
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });
      return {
        data: user,
      };
    } catch (error) {
      if (error.code == 'P2002') {
        throw new ForbiddenException(error.message);
      }
      return error;
    }
  }

  async login(authDTO: AuthDTO) {
    const user = await this.prismaService.user.findUnique({
      where: {
        email: authDTO.email,
      },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const passwordMathched = await argon.verify(
      user.hashedPassword,
      authDTO.password,
    );
    if (!passwordMathched) {
      throw new ForbiddenException('Incorrect password');
    }
    return {
      user: user,
      access_token: await this.signJwtString(user.id, user.email),
    };
  }

  async signJwtString(
    userId: number,
    email: string,
  ): Promise<{ accessTocken: string }> {
    const payload = {
      sub: userId,
      email,
    };
    const jwtString = await this.jwtService.signAsync(payload, {
      expiresIn: '10m', // 10 min token expiration time
      secret: this.configService.get('JWT_SECRET'),
    });
    return {
      accessTocken: jwtString,
    };
  }
}
