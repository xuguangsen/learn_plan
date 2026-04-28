# Go Todo 学习项目说明

这是一个前后端分离的学习型项目，用来实现用户注册登录、学习状态保存和简单统计展示。  
后端使用 `Spring Boot + MyBatis + MySQL`，前端使用原生 `HTML + CSS + JavaScript`。

## 项目结构

```text
learn_plan/
|-- frontend/                         # 前端静态页面
|   |-- login.html                    # 登录/注册页
|   |-- index.html                    # 主页面
|   |-- timer.html                    # 计时页面
|   |-- stats.html                    # 统计页面
|   |-- login.js                      # 登录页交互逻辑
|   |-- script.js                     # 主页面交互逻辑
|   |-- config.js                     # 前端 API 地址配置
|   `-- styles.css                    # 页面样式
|-- backend/
|   |-- pom.xml                       # Maven 依赖配置
|   `-- src/main/
|       |-- java/com/gotodo/app/
|       |   |-- GoTodoApplication.java
|       |   |-- config/               # Spring 配置类
|       |   |-- controller/           # 控制器层
|       |   |-- service/              # 业务层
|       |   |-- mapper/               # MyBatis Mapper 接口
|       |   |-- entity/               # 实体类
|       |   |-- dto/                  # 请求/响应对象
|       |   `-- exception/            # 异常处理
|       `-- resources/
|           |-- application.yml       # Spring Boot 配置文件
|           |-- schema.sql            # 建表脚本
|           `-- mapper/               # MyBatis XML Mapper 示例
|-- start-server.bat                  # 启动后端
|-- start-frontend.bat                # 启动前端静态服务器
`-- stop-server.bat                   # 停止后端
```

## 技术栈

- 后端框架：`Spring Boot`
- 数据访问：`MyBatis`
- 数据库：`MySQL`
- 登录认证：`JWT`
- 密码加密：`BCrypt`
- 前端：原生 `HTML / CSS / JavaScript`
- 构建工具：`Maven`

## 后端分层架构

```text
浏览器 / 前端页面
        |
        v
Controller  接收请求、返回响应
        |
        v
Service     编排业务逻辑、校验参数、控制事务
        |
        v
Mapper      执行 SQL，读写 MySQL
        |
        v
MySQL
```

各层职责：

- `Controller`
  接收 HTTP 请求，比如 `/api/auth/login`、`/api/state`。
- `Service`
  处理登录、注册、JWT 校验、状态保存等业务逻辑。
- `Mapper`
  负责真正访问数据库。
- `Entity`
  承接数据库记录。
- `DTO`
  定义前后端交互的数据结构。

## 当前登录实现

这个项目现在已经从“数据库保存自定义 token”切换到了“JWT 无状态认证”：

1. 用户在前端输入用户名和密码。
2. 前端用 `fetch` 调用 `/api/auth/register` 或 `/api/auth/login`。
3. `AuthService` 校验用户名和密码。
4. 注册时把加密后的密码保存到 `app_user` 表。
5. 登录或注册成功后，`JwtService` 生成 JWT。
6. 后端把 JWT 返回给前端。
7. 前端把 JWT 存入 `localStorage`。
8. 之后调用 `/api/auth/me`、`/api/state` 时，在请求头里带上：

```http
Authorization: Bearer <token>
```

9. 后端通过 `JwtService` 解析 token，拿到用户 ID，再查询数据库确认用户存在。

当前 `logout` 接口不再删除数据库里的 token，而是由前端清除本地 JWT 来完成退出登录。

## MyBatis 两种写法

这个项目里同时保留了两种 MyBatis 用法，方便学习对比：

### 1. XML Mapper 写法

- 接口：[`backend/src/main/java/com/gotodo/app/mapper/AppUserMapper.java`](/c:/Users/Administrator/Desktop/Project/learn_plan/backend/src/main/java/com/gotodo/app/mapper/AppUserMapper.java:1)
- XML：[`backend/src/main/resources/mapper/AppUserMapper.xml`](/c:/Users/Administrator/Desktop/Project/learn_plan/backend/src/main/resources/mapper/AppUserMapper.xml:1)

特点：
- Java 接口里只写方法声明
- SQL 放在 XML 中
- 更适合复杂查询和统一管理 SQL

### 2. 注解 Mapper 写法

- [`backend/src/main/java/com/gotodo/app/mapper/UserStateMapper.java`](/c:/Users/Administrator/Desktop/Project/learn_plan/backend/src/main/java/com/gotodo/app/mapper/UserStateMapper.java:1)

特点：
- SQL 直接写在注解里
- 文件更少
- 适合简单 CRUD

## 关键文件说明

### 启动与配置

- [GoTodoApplication.java](/c:/Users/Administrator/Desktop/Project/learn_plan/backend/src/main/java/com/gotodo/app/GoTodoApplication.java:1)
  Spring Boot 启动入口。

- [application.yml](/c:/Users/Administrator/Desktop/Project/learn_plan/backend/src/main/resources/application.yml:1)
  定义端口、数据库连接、MyBatis、CORS、JWT 等配置。

- [schema.sql](/c:/Users/Administrator/Desktop/Project/learn_plan/backend/src/main/resources/schema.sql:1)
  定义 `app_user` 和 `user_state` 两张表。

- [WebConfig.java](/c:/Users/Administrator/Desktop/Project/learn_plan/backend/src/main/java/com/gotodo/app/config/WebConfig.java:1)
  配置跨域访问。

- [PasswordConfig.java](/c:/Users/Administrator/Desktop/Project/learn_plan/backend/src/main/java/com/gotodo/app/config/PasswordConfig.java:1)
  注册 `PasswordEncoder`。

### 认证与状态保存

- [AuthController.java](/c:/Users/Administrator/Desktop/Project/learn_plan/backend/src/main/java/com/gotodo/app/controller/AuthController.java:1)
  注册、登录、获取当前用户、退出登录。

- [AuthService.java](/c:/Users/Administrator/Desktop/Project/learn_plan/backend/src/main/java/com/gotodo/app/service/AuthService.java:1)
  登录注册核心业务逻辑。

- [JwtService.java](/c:/Users/Administrator/Desktop/Project/learn_plan/backend/src/main/java/com/gotodo/app/service/JwtService.java:1)
  生成和解析 JWT。

- [StateController.java](/c:/Users/Administrator/Desktop/Project/learn_plan/backend/src/main/java/com/gotodo/app/controller/StateController.java:1)
  读取和保存用户学习状态。

- [UserStateService.java](/c:/Users/Administrator/Desktop/Project/learn_plan/backend/src/main/java/com/gotodo/app/service/UserStateService.java:1)
  状态 JSON 的持久化业务逻辑。

## 数据库设计

### `app_user`

- `id`：主键
- `username`：用户名
- `password_hash`：BCrypt 加密后的密码
- `created_at`：创建时间
- `updated_at`：更新时间

### `user_state`

- `id`：主键
- `user_id`：关联用户 ID
- `state_json`：整份学习状态 JSON
- `created_at`：创建时间
- `updated_at`：更新时间

## 配置说明

主要配置文件是 [`backend/src/main/resources/application.yml`](/c:/Users/Administrator/Desktop/Project/learn_plan/backend/src/main/resources/application.yml:1)。

重点配置包括：

- `spring.datasource.*`
  MySQL 数据源
- `mybatis.mapper-locations`
  XML Mapper 文件路径
- `app.cors.allowed-origins`
  允许跨域的前端地址
- `app.jwt.secret`
  JWT 签名密钥
- `app.jwt.expiration-hours`
  JWT 过期时间

## 运行方式

1. 启动 MySQL，并确保存在数据库 `go_todo`
2. 在 IDEA 中运行 [GoTodoApplication.java](/c:/Users/Administrator/Desktop/Project/learn_plan/backend/src/main/java/com/gotodo/app/GoTodoApplication.java:1)
3. 运行 [start-frontend.bat](/c:/Users/Administrator/Desktop/Project/learn_plan/start-frontend.bat:1)
4. 浏览器访问 `http://localhost:5500/login.html`

如果你用 IDEA 直接打开前端页面，常见来源是 `http://localhost:63342/...`，当前项目也已经允许这个来源跨域访问后端。

## 适合学习的重点

- Spring Boot 项目结构
- Controller / Service / Mapper 分层
- JWT 登录认证
- BCrypt 密码加密
- MyBatis 注解写法
- MyBatis XML 写法
- MySQL 表设计
- `fetch` 调用后端接口
- CORS 跨域配置
- 全局异常处理
