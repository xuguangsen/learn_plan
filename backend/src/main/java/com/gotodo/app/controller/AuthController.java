package com.gotodo.app.controller;

import com.gotodo.app.dto.AuthRequest;
import com.gotodo.app.dto.AuthResponse;
import com.gotodo.app.dto.MeResponse;
import com.gotodo.app.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 认证接口控制器。
 * Controller 只负责接收 HTTP 请求和返回响应，具体业务交给 Service 层处理。
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthService authService;

  public AuthController(AuthService authService) {
    this.authService = authService;
  }

  /**
   * 注册新用户。
   */
  @PostMapping("/register")
  public AuthResponse register(@RequestBody AuthRequest request) {
    return authService.register(request);
  }

  /**
   * 用户登录，成功后返回 token。
   */
  @PostMapping("/login")
  public AuthResponse login(@RequestBody AuthRequest request) {
    return authService.login(request);
  }

  /**
   * 获取当前登录用户信息。
   */
  @GetMapping("/me")
  public MeResponse me(@RequestHeader(value = "Authorization", required = false) String authorization) {
    return authService.getMe(authorization);
  }

  /**
   * 退出登录，本质上是清空数据库里保存的 token。
   */
  @PostMapping("/logout")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
    authService.logout(authorization);
  }
}
