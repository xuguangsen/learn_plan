package com.gotodo.app.dto;

/**
 * 登录/注册请求体。
 */
public record AuthRequest(String username, String password) {
}
