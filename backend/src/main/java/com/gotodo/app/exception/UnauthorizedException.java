package com.gotodo.app.exception;

/**
 * 自定义未授权异常。
 * 抛出后会被全局异常处理器转换成 HTTP 401 响应。
 */
public class UnauthorizedException extends RuntimeException {
  public UnauthorizedException(String message) {
    super(message);
  }
}
