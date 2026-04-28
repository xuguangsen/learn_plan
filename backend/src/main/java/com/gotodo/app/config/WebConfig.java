package com.gotodo.app.config;

import java.util.stream.Stream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web 层配置。
 * 当前主要负责跨域设置，让前端页面可以访问后端的 /api/** 接口。
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {
  private final String[] allowedOrigins;

  public WebConfig(
    @Value("${app.cors.allowed-origins:http://localhost:5500,http://127.0.0.1:5500,http://localhost:5173,http://127.0.0.1:5173}")
    String origins
  ) {
    this.allowedOrigins = Stream.of(origins.split(","))
      .map(String::trim)
      .filter((item) -> !item.isEmpty())
      .toArray(String[]::new);
  }

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    // 只放行 API 路径，静态资源和其他路径不在这里处理。
    registry.addMapping("/api/**")
      .allowedOrigins(allowedOrigins)
      .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
      .allowedHeaders("*")
      .maxAge(3600);
  }
}
