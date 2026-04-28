package com.gotodo.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Spring Boot 应用入口。
 * 运行这个 main 方法后，Spring 会完成组件扫描、配置加载、Web 服务启动等初始化工作。
 */
@SpringBootApplication
public class GoTodoApplication {
  public static void main(String[] args) {
    SpringApplication.run(GoTodoApplication.class, args);
  }
}
