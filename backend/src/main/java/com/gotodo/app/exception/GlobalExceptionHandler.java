package com.gotodo.app.exception;

import com.gotodo.app.dto.ErrorResponse;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 全局异常处理器。
 * 作用是把 Java 异常统一转换成前端更容易处理的 JSON 响应。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {
  @ExceptionHandler(UnauthorizedException.class)
  public ResponseEntity<ErrorResponse> handleUnauthorized(UnauthorizedException ex) {
    return build(HttpStatus.UNAUTHORIZED, ex.getMessage());
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<ErrorResponse> handleBadRequest(IllegalArgumentException ex) {
    return build(HttpStatus.BAD_REQUEST, ex.getMessage());
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
    return build(HttpStatus.INTERNAL_SERVER_ERROR, "服务器内部错误，请稍后重试。");
  }

  private ResponseEntity<ErrorResponse> build(HttpStatus status, String message) {
    ErrorResponse payload = new ErrorResponse(
      Instant.now(),
      status.value(),
      status.getReasonPhrase(),
      message
    );
    return ResponseEntity.status(status).body(payload);
  }
}
