package com.gotodo.app.service;

import com.gotodo.app.entity.AppUser;
import com.gotodo.app.exception.UnauthorizedException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * JWT 服务。
 * 负责生成和解析 token，让当前项目的登录态从“数据库保存 token”切换到“无状态 JWT”。
 */
@Service
public class JwtService {
  private final SecretKey signingKey;
  private final Duration expiration;

  public JwtService(
    @Value("${app.jwt.secret}") String secret,
    @Value("${app.jwt.expiration-hours}") long expirationHours
  ) {
    this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    this.expiration = Duration.ofHours(expirationHours);
  }

  public String generateToken(AppUser user) {
    Instant now = Instant.now();
    Instant expiresAt = now.plus(expiration);

    return Jwts.builder()
      .subject(String.valueOf(user.getId()))
      .claim("username", user.getUsername())
      .issuedAt(Date.from(now))
      .expiration(Date.from(expiresAt))
      .signWith(signingKey)
      .compact();
  }

  public Long extractUserId(String token) {
    Claims claims = parseClaims(token);
    return Long.valueOf(claims.getSubject());
  }

  private Claims parseClaims(String token) {
    try {
      return Jwts.parser()
        .verifyWith(signingKey)
        .build()
        .parseSignedClaims(token)
        .getPayload();
    } catch (JwtException | IllegalArgumentException ex) {
      throw new UnauthorizedException("登录凭证无效或已过期，请重新登录。");
    }
  }
}
