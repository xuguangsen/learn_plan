package com.gotodo.app.dto;

/**
 * 当前登录用户信息响应体。
 */
public record MeResponse(Long userId, String username) {
}
