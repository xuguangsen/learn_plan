package com.gotodo.app.dto;

import java.time.Instant;

/**
 * 统一错误响应结构。
 */
public record ErrorResponse(Instant timestamp, int status, String error, String message) {
}
