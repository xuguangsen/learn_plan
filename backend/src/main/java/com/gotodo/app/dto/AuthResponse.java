package com.gotodo.app.dto;

/**
 * 登录/注册成功后的响应体。
 */
public record AuthResponse(Long userId, String username, String token) {
}
