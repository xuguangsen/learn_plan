package com.gotodo.app.service;

import com.gotodo.app.dto.AuthRequest;
import com.gotodo.app.dto.AuthResponse;
import com.gotodo.app.dto.MeResponse;
import com.gotodo.app.entity.AppUser;
import com.gotodo.app.exception.UnauthorizedException;
import com.gotodo.app.mapper.AppUserMapper;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 认证业务层。
 * 这里负责参数校验、密码处理、JWT 生成，以及和数据库交互的业务编排。
 */
@Service
public class AuthService {
  private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9_]{3,24}$");
  private static final int MIN_PASSWORD_LEN = 6;
  private static final int MAX_PASSWORD_LEN = 72;

  private final AppUserMapper appUserMapper;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;

  public AuthService(AppUserMapper appUserMapper, PasswordEncoder passwordEncoder, JwtService jwtService) {
    this.appUserMapper = appUserMapper;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
  }

  /**
   * 注册流程：
   * 1. 校验输入
   * 2. 检查用户名是否重复
   * 3. 对密码做哈希
   * 4. 保存用户
   * 5. 返回 JWT
   */
  @Transactional
  public AuthResponse register(AuthRequest request) {
    Credentials credentials = normalizeAndValidate(request);
    if (appUserMapper.existsByUsername(credentials.username())) {
      throw new IllegalArgumentException("用户名已存在，请更换后重试。");
    }

    AppUser user = new AppUser();
    user.setUsername(credentials.username());
    user.setPasswordHash(passwordEncoder.encode(credentials.password()));
    appUserMapper.insert(user);

    String token = jwtService.generateToken(user);
    return toAuthResponse(user, token);
  }

  /**
   * 登录流程：
   * 1. 按用户名查用户
   * 2. 校验密码哈希
   * 3. 生成 JWT 返回给前端
   */
  @Transactional(readOnly = true)
  public AuthResponse login(AuthRequest request) {
    Credentials credentials = normalizeAndValidate(request);
    AppUser user = appUserMapper.findByUsername(credentials.username())
      .orElseThrow(() -> new UnauthorizedException("用户名或密码错误。"));

    if (!passwordEncoder.matches(credentials.password(), user.getPasswordHash())) {
      throw new UnauthorizedException("用户名或密码错误。");
    }

    String token = jwtService.generateToken(user);
    return toAuthResponse(user, token);
  }

  /**
   * JWT 是无状态的，后端不再保存 token。
   * 当前退出登录的效果由前端删除本地 token 来完成。
   */
  @Transactional(readOnly = true)
  public void logout(String authorizationHeader) {
    extractToken(authorizationHeader);
  }

  @Transactional(readOnly = true)
  public MeResponse getMe(String authorizationHeader) {
    AppUser user = requireUser(authorizationHeader);
    return new MeResponse(user.getId(), user.getUsername());
  }

  /**
   * 这是受保护接口的公共认证入口。
   * 如果 JWT 不存在、已过期或数据库中查不到对应用户，就抛出 401。
   */
  @Transactional(readOnly = true)
  public AppUser requireUser(String authorizationHeader) {
    String token = extractToken(authorizationHeader);
    Long userId = jwtService.extractUserId(token);
    return appUserMapper.findById(userId)
      .orElseThrow(() -> new UnauthorizedException("未登录或登录状态已失效，请重新登录。"));
  }

  /**
   * 统一做用户名和密码的基础校验，避免注册和登录重复写校验逻辑。
   */
  private Credentials normalizeAndValidate(AuthRequest request) {
    if (request == null) {
      throw new IllegalArgumentException("请求体不能为空。");
    }

    String username = (request.username() == null ? "" : request.username().trim()).toLowerCase(Locale.ROOT);
    String password = request.password() == null ? "" : request.password();

    if (!USERNAME_PATTERN.matcher(username).matches()) {
      throw new IllegalArgumentException("用户名需为 3-24 位字母、数字或下划线。");
    }
    if (password.length() < MIN_PASSWORD_LEN || password.length() > MAX_PASSWORD_LEN) {
      throw new IllegalArgumentException("密码长度需为 6-72 位。");
    }
    return new Credentials(username, password);
  }

  private AuthResponse toAuthResponse(AppUser user, String token) {
    return new AuthResponse(user.getId(), user.getUsername(), token);
  }

  /**
   * 从 Authorization 请求头中提取 Bearer token。
   */
  private String extractToken(String authorizationHeader) {
    if (authorizationHeader == null) {
      throw new UnauthorizedException("未登录或登录状态已失效，请重新登录。");
    }
    String prefix = "Bearer ";
    if (!authorizationHeader.startsWith(prefix)) {
      throw new UnauthorizedException("未登录或登录状态已失效，请重新登录。");
    }
    String token = authorizationHeader.substring(prefix.length()).trim();
    if (token.isEmpty()) {
      throw new UnauthorizedException("未登录或登录状态已失效，请重新登录。");
    }
    return token;
  }

  private record Credentials(String username, String password) {
  }
}
