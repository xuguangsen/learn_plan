package com.gotodo.app.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.gotodo.app.entity.AppUser;
import com.gotodo.app.service.AuthService;
import com.gotodo.app.service.UserStateService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 学习状态接口控制器。
 * 状态数据按用户隔离保存，请求进入后会先校验登录身份。
 */
@RestController
@RequestMapping("/api/state")
public class StateController {
  private final AuthService authService;
  private final UserStateService userStateService;

  public StateController(AuthService authService, UserStateService userStateService) {
    this.authService = authService;
    this.userStateService = userStateService;
  }

  /**
   * 读取当前用户的学习状态。
   */
  @GetMapping
  public JsonNode getState(@RequestHeader(value = "Authorization", required = false) String authorization) {
    AppUser user = authService.requireUser(authorization);
    return userStateService.getState(user);
  }

  /**
   * 保存当前用户的学习状态。
   */
  @PostMapping
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void saveState(
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @RequestBody JsonNode payload
  ) {
    AppUser user = authService.requireUser(authorization);
    userStateService.saveState(user, payload);
  }
}
