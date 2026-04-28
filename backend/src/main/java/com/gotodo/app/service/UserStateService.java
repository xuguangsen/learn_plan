package com.gotodo.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gotodo.app.entity.AppUser;
import com.gotodo.app.entity.UserState;
import com.gotodo.app.mapper.UserStateMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 学习状态业务层。
 * 负责把前端传来的 JSON 状态按用户持久化到数据库中。
 */
@Service
public class UserStateService {
  private static final String DEFAULT_STATE_JSON = "{\"plans\":[],\"records\":{},\"sessionLogs\":{},\"session\":null,\"theme\":\"light\"}";

  private final UserStateMapper userStateMapper;
  private final ObjectMapper objectMapper;

  public UserStateService(UserStateMapper userStateMapper, ObjectMapper objectMapper) {
    this.userStateMapper = userStateMapper;
    this.objectMapper = objectMapper;
  }

  /**
   * 首次访问时如果数据库没有记录，会自动创建默认状态。
   */
  @Transactional
  public JsonNode getState(AppUser user) {
    UserState state = userStateMapper.findByUserId(user.getId())
      .orElseGet(() -> createDefaultState(user));
    return parseState(state.getStateJson());
  }

  /**
   * 保存前端传来的整份状态 JSON。
   * 这里采用“整块覆盖”的方式，而不是只更新某个局部字段。
   */
  @Transactional
  public void saveState(AppUser user, JsonNode payload) {
    if (payload == null || !payload.isObject()) {
      throw new IllegalArgumentException("状态数据必须是 JSON 对象。");
    }

    UserState state = userStateMapper.findByUserId(user.getId())
      .orElseGet(() -> {
        UserState created = new UserState();
        created.setUserId(user.getId());
        created.setStateJson(DEFAULT_STATE_JSON);
        return created;
      });

    state.setStateJson(payload.toString());
    if (state.getId() == null) {
      userStateMapper.insert(state);
      return;
    }
    userStateMapper.updateStateJson(state.getId(), state.getStateJson());
  }

  private UserState createDefaultState(AppUser user) {
    UserState state = new UserState();
    state.setUserId(user.getId());
    state.setStateJson(DEFAULT_STATE_JSON);
    userStateMapper.insert(state);
    return state;
  }

  private JsonNode parseState(String rawState) {
    try {
      return objectMapper.readTree(rawState);
    } catch (Exception ignored) {
      try {
        return objectMapper.readTree(DEFAULT_STATE_JSON);
      } catch (Exception ex) {
        throw new IllegalStateException("默认状态解析失败。");
      }
    }
  }
}
